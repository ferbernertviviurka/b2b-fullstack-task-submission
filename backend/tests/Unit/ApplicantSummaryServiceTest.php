<?php

namespace Tests\Unit;

use App\Models\Applicant;
use App\Models\Campaign;
use App\Services\ApplicantSummaryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ApplicantSummaryServiceTest extends TestCase
{
    use RefreshDatabase;

    private function campaignWithScores(array $scores): Campaign
    {
        $campaign = Campaign::factory()->create();
        foreach ($scores as $score) {
            Applicant::factory()->for($campaign)->create(['ai_score' => $score]);
        }

        return $campaign;
    }

    public function test_computes_aggregates_at_threshold_boundaries(): void
    {
        $campaign = $this->campaignWithScores([90, 89, 70, 69]);

        $summary = (new ApplicantSummaryService)->summary($campaign);

        $this->assertSame(4, $summary['total_applicants']);
        $this->assertSame(3, $summary['eligible_applicants']); // 90, 89, 70 (>= 70); 69 excluded
        $this->assertSame(79.5, $summary['average_ai_score']);
        $this->assertSame([90], array_column($summary['top_applicants'], 'ai_score')); // >= 90 only
    }

    public function test_top_applicants_are_capped_at_five_in_descending_order(): void
    {
        $campaign = $this->campaignWithScores([90, 91, 92, 93, 94, 95, 96, 50]);

        $summary = (new ApplicantSummaryService)->summary($campaign);

        $this->assertSame([96, 95, 94, 93, 92], array_column($summary['top_applicants'], 'ai_score'));
    }

    public function test_empty_campaign_is_zeroed_without_dividing_by_zero(): void
    {
        $summary = (new ApplicantSummaryService)->summary(Campaign::factory()->create());

        $this->assertSame([
            'total_applicants' => 0,
            'eligible_applicants' => 0,
            'average_ai_score' => 0.0,
            'top_applicants' => [],
        ], $summary);
    }

    public function test_summary_uses_two_queries_regardless_of_applicant_count(): void
    {
        $campaign = $this->campaignWithScores(range(1, 100));

        DB::enableQueryLog();
        (new ApplicantSummaryService)->summary($campaign);

        $this->assertCount(2, DB::getQueryLog());
    }
}
