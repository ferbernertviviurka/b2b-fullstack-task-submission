<?php

namespace Tests\Feature;

use App\Models\Applicant;
use App\Models\Campaign;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ApplicantSummaryTest extends TestCase
{
    use RefreshDatabase;

    private function summary(string $campaignId, string $query = '', array $headers = ['X-Partner-Token' => 'partner-demo']): TestResponse
    {
        return $this->get("/api/v1/campaigns/{$campaignId}/applicant-summary{$query}", $headers);
    }

    private function campaignWithScores(array $scores): Campaign
    {
        $campaign = Campaign::factory()->create();
        foreach ($scores as $score) {
            Applicant::factory()->for($campaign)->create(['ai_score' => $score]);
        }

        return $campaign;
    }

    private function assertJsonApiError(TestResponse $response, int $status): void
    {
        $response->assertStatus($status)
            ->assertHeader('Content-Type', 'application/vnd.api+json')
            ->assertJsonStructure(['errors' => [['status', 'title', 'detail']]])
            ->assertJsonPath('errors.0.status', (string) $status);
    }

    public function test_returns_applicants_and_database_aggregates(): void
    {
        $campaign = $this->campaignWithScores([95, 91, 90, 85, 70, 69, 10]);
        $this->campaignWithScores([100, 100]); // another campaign must not leak into the metrics

        $response = $this->summary((string) $campaign->id);

        $response->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.api+json')
            ->assertJsonPath('meta.summary.total_applicants', 7)
            ->assertJsonPath('meta.summary.eligible_applicants', 5)
            ->assertJsonPath('meta.summary.average_ai_score', 72.86) // 510 / 7
            ->assertJsonPath('meta.summary.top_applicants.*.ai_score', [95, 91, 90])
            ->assertJsonPath('meta.pagination', ['page' => 1, 'size' => 10, 'total_pages' => 1, 'total' => 7])
            ->assertJsonPath('data.0.type', 'applicants')
            ->assertJsonPath('data.*.attributes.ai_score', [95, 91, 90, 85, 70, 69, 10])
            ->assertJsonStructure([
                'data' => [['type', 'id', 'attributes' => ['name', 'ai_score', 'status', 'applied_at', 'highlights']]],
                'links' => ['first', 'last', 'prev', 'next'],
            ]);
        $this->assertIsString($response->json('data.0.id'));
        $this->assertIsString($response->json('meta.summary.top_applicants.0.id'));
    }

    public function test_empty_campaign_returns_zeroed_aggregates(): void
    {
        $campaign = Campaign::factory()->create();

        $response = $this->summary((string) $campaign->id);

        $response->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonPath('meta.summary', [
                'total_applicants' => 0,
                'eligible_applicants' => 0,
                'average_ai_score' => 0.0,
                'top_applicants' => [],
            ]);
        $this->assertStringContainsString('"average_ai_score":0.0', $response->getContent());
    }

    public function test_missing_partner_token_returns_401(): void
    {
        $campaign = Campaign::factory()->create();

        $response = $this->summary((string) $campaign->id, '', []);

        $this->assertJsonApiError($response, 401);
        $response->assertJsonPath('errors.0.detail', 'Missing or empty X-Partner-Token header.');
    }

    public function test_blank_partner_token_returns_401(): void
    {
        $campaign = Campaign::factory()->create();

        $this->assertJsonApiError($this->summary((string) $campaign->id, '', ['X-Partner-Token' => '   ']), 401);
    }

    public function test_unknown_campaign_returns_404(): void
    {
        $response = $this->summary('999');

        $this->assertJsonApiError($response, 404);
        $response->assertJsonPath('errors.0.detail', 'Campaign 999 not found.');
    }

    #[DataProvider('malformedCampaignIds')]
    public function test_malformed_campaign_id_returns_422(string $campaignId): void
    {
        $this->assertJsonApiError($this->summary($campaignId), 422);
    }

    public static function malformedCampaignIds(): array
    {
        return ['text' => ['abc'], 'zero' => ['0'], 'negative' => ['-1'], 'decimal' => ['1.5']];
    }

    #[DataProvider('invalidQueries')]
    public function test_invalid_query_parameters_return_422(string $query): void
    {
        $campaign = Campaign::factory()->create();

        $this->assertJsonApiError($this->summary((string) $campaign->id, $query), 422);
    }

    public static function invalidQueries(): array
    {
        return [
            'min_score above 100' => ['?min_score=101'],
            'min_score below 0' => ['?min_score=-1'],
            'min_score non-numeric' => ['?min_score=abc'],
            'page size above 100' => ['?page[size]=101'],
            'page size zero' => ['?page[size]=0'],
            'page number zero' => ['?page[number]=0'],
            'page number above cap' => ['?page[number]=1000001'],
            'page not an object' => ['?page=2'],
        ];
    }

    #[DataProvider('validBoundaryQueries')]
    public function test_boundary_query_values_are_accepted(string $query): void
    {
        $campaign = Campaign::factory()->create();

        $this->summary((string) $campaign->id, $query)->assertOk();
    }

    public static function validBoundaryQueries(): array
    {
        return [
            'min_score 0' => ['?min_score=0'],
            'min_score 100' => ['?min_score=100'],
            'page size 1' => ['?page[size]=1'],
            'page size 100' => ['?page[size]=100'],
            'page number at cap' => ['?page[number]=1000000'],
        ];
    }

    public function test_min_score_filters_the_list_but_not_the_campaign_summary(): void
    {
        $campaign = $this->campaignWithScores([95, 85, 80, 79, 10]);

        $response = $this->summary((string) $campaign->id, '?min_score=80')
            ->assertOk()
            ->assertJsonPath('data.*.attributes.ai_score', [95, 85, 80])
            ->assertJsonPath('meta.pagination.total', 3);

        $top = $campaign->applicants()->firstWhere('ai_score', 95);
        $this->assertSame([
            'total_applicants' => 5,
            'eligible_applicants' => 4,
            'average_ai_score' => 69.8, // 349 / 5
            'top_applicants' => [
                ['id' => (string) $top->id, 'name' => $top->name, 'ai_score' => 95],
            ],
        ], $response->json('meta.summary'));
    }

    public function test_links_ignore_a_spoofed_host_header(): void
    {
        $campaign = $this->campaignWithScores(range(50, 61));

        $response = $this->get("http://evil.example/api/v1/campaigns/{$campaign->id}/applicant-summary?page[size]=5&page[number]=2", [
            'X-Partner-Token' => 'partner-demo',
            'Host' => 'evil.example',
        ]);

        $response->assertOk();
        foreach (['first', 'last', 'prev', 'next'] as $link) {
            $this->assertStringStartsWith(rtrim(config('app.url'), '/').'/api/v1/', $response->json("links.{$link}"), $link);
            $this->assertStringNotContainsString('evil.example', $response->json("links.{$link}"), $link);
        }
    }

    public function test_framework_errors_hide_internals_and_keep_their_headers(): void
    {
        $campaign = Campaign::factory()->create();

        $notFound = $this->get('/api/v1/nope', ['X-Partner-Token' => 'partner-demo']);
        $this->assertJsonApiError($notFound, 404);
        $notFound->assertJsonPath('errors.0.detail', 'Not Found');

        $notAllowed = $this->post("/api/v1/campaigns/{$campaign->id}/applicant-summary", [], ['X-Partner-Token' => 'partner-demo']);
        $this->assertJsonApiError($notAllowed, 405);
        $notAllowed->assertJsonPath('errors.0.detail', 'Method Not Allowed')
            ->assertHeader('Allow', 'GET, HEAD');
    }

    public function test_paginates_with_links(): void
    {
        $campaign = $this->campaignWithScores(range(50, 61));

        $response = $this->summary((string) $campaign->id, '?page[size]=5&page[number]=2');

        $response->assertOk()
            ->assertJsonCount(5, 'data')
            ->assertJsonPath('meta.pagination', ['page' => 2, 'size' => 5, 'total_pages' => 3, 'total' => 12]);
        foreach (['first' => 1, 'last' => 3, 'prev' => 1, 'next' => 3] as $link => $number) {
            parse_str((string) parse_url($response->json("links.{$link}"), PHP_URL_QUERY), $query);
            $this->assertSame(['number' => (string) $number, 'size' => '5'], $query['page'], $link);
        }

        $this->summary((string) $campaign->id, '?page[size]=5&page[number]=3')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('links.next', null);
        $this->summary((string) $campaign->id, '?page[size]=5')
            ->assertJsonPath('links.prev', null);

        $beyond = $this->summary((string) $campaign->id, '?page[size]=5&page[number]=99');
        $beyond->assertOk()->assertJsonPath('data', [])->assertJsonPath('links.next', null);
        parse_str((string) parse_url($beyond->json('links.prev'), PHP_URL_QUERY), $query);
        $this->assertSame('3', $query['page']['number']);
    }
}
