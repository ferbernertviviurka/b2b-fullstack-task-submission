# AI Log — Task 3 evidence (append-only)

Every meaningful code generation gets one entry, logged **before** refactoring.
Never edit past entries. `TASK_REPORT.md` may only cite prompts and snippets that
exist here. Review findings from the `code-reviewer` agent are appended under
`## Review findings — <phase> — <date>`.

Entry template:

````markdown
## <YYYY-MM-DD HH:MM> — <phase> — <what was generated>

**Prompt (verbatim):**
```text
<the exact prompt used, unedited>
```

**Raw output (before refactor):**
```php
<the generated code as produced>
```

**Refactor notes:** what changed and why — name defects technically
(N+1, missing zero-guard, `any`, color-only badge, missing disabled state).
````

---

<!-- Entries start below this line -->

## 2026-10-14 20:15 — P0 scaffold — Laravel 11 + Nuxt 3 skeletons

**Prompt (verbatim, orchestrator → backend-laravel):**
```text
Phase P0 scaffold, backend only. [...] 1. `composer create-project laravel/laravel:^11.0 backend` [...] 2. In backend/phpunit.xml make tests use SQLite in-memory [...] 3. Run `cd backend && php artisan test` and confirm green.
Do NOT: run `php artisan install:api`, install Sanctum or any package, create routes/api.php, create campaign/applicant migrations/models/factories [...] Those depend on architectural decisions pending with the human.
```

**Prompt (verbatim, orchestrator → frontend-nuxt):**
```text
Phase P0 scaffold, frontend only. [...] 1. Create a minimal Nuxt 3 app in `frontend/` (npm). Careful: current `nuxi init` defaults to Nuxt 4 — the brief requires Nuxt 3 [...]
Do NOT: add Tailwind, Vitest, @vue/test-utils, @nuxt/test-utils, PrimeVue or any other package [...] Tooling integration choices are pending with the human.
```

**Raw output (installer-generated, no hand-written code):**
- `composer create-project laravel/laravel:^11.0 backend` → Laravel Framework 11.57.0 (PHP 8.3.22). `phpunit.xml`: uncommented `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:` (FRD-00 default). `php artisan test` → 2 passed (stock ExampleTests).
- `npx nuxi@latest init frontend --template v3 --packageManager npm --no-gitInit --no-modules` → nuxt 3.21.11, vue ^3.5.40, TS strict (Nuxt default). `npm run build` → Build complete.

**Refactor notes / scaffold choices:**
- Frozen by FRD-00/brief: Laravel 11, Nuxt 3, SQLite in-memory for tests — applied as-is.
- Caught by orchestrator: `nuxi init` defaults to Nuxt 4 today → forced `--template v3` to honor the brief.
- Side effect: Laravel installer created `backend/database/database.sqlite` (local dev DB, unused by tests) — left as-is.
- Deliberately NOT done, pending human decisions (Architectural Decision Protocol): API route registration (`install:api`/Sanctum vs manual), applicant `status` storage. Tailwind/Vitest integration deferred to P2 kickoff.

## 2026-10-14 20:25 — P0 scaffold — campaigns migration, model, factory

**Prompt (verbatim excerpt, orchestrator → backend-laravel):**
```text
Create ONLY the campaigns table, per docs/frd/FRD-00-overview.md (campaignId = positive auto-increment integer):
- migration `create_campaigns_table`: `id()`, `string('name')`, `timestamps()`. Nothing else.
- `app/Models/Campaign.php` with `HasFactory`, `$fillable = ['name']`. No relations yet (applicants table does not exist yet).
- `database/factories/CampaignFactory.php`: name = fake()->catchPhrase() or similar.
Do NOT create the applicants migration/model/factory, routes/api.php, or install anything — the applicant `status` storage and API routing are pending human decisions.
```

**Raw output (before refactor):**
```php
// database/migrations/2026_10_14_230821_create_campaigns_table.php
Schema::create('campaigns', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->timestamps();
});

// app/Models/Campaign.php
class Campaign extends Model
{
    use HasFactory;
    protected $fillable = ['name'];
}

// database/factories/CampaignFactory.php
public function definition(): array
{
    return ['name' => fake()->catchPhrase()];
}
```

**Refactor notes:** none needed — matches the prompt exactly. `php artisan test` green (2 passed); `Campaign::factory()->create()` verified on SQLite :memory:.

## Decision — API route registration (Laravel 11) — 2026-10-14

**Options presented:** A) hand-made `routes/api.php` registered via `withRouting(api:)` in `bootstrap/app.php`; B) `php artisan install:api` (adds Sanctum + `personal_access_tokens` migration); C) `/api/v1` group inside `routes/web.php`.
**Choice:** A (human).
**Rationale (human, verbatim):** "hand-made routes/api.php registered in bootstrap/app.php keeps the exact file location FR-B1 requires and adds zero unused dependencies — install:api would ship Sanctum plus a personal_access_tokens migration nothing uses (dead code in a reviewed repo), and web.php would run session/CSRF middleware on a stateless API."
**Implementation:** P1 (FR-B1), by `backend-laravel`.

## Decision — applicant `status` storage — 2026-10-14

**Options presented:** A) string column + PHP backed enum cast; B) native DB `enum()` column; C) `statuses` lookup table + FK.
**Choice:** human's own approach — hybrid of A + B.
**Rationale (human, verbatim):** "hybrid — string-backed PHP enum (ApplicantStatus) cast on the model AND a database enum/CHECK constraint, with the migration deriving its values from the PHP enum (array_column(ApplicantStatus::cases(), 'value')) so there is a single source of truth. Rationale: the cast gives type safety in the app layer, the constraint guards writes that bypass Eloquent (bulk DB::table updates, seeds, manual SQL). Accepted trade-off: extending the workflow later requires an ALTER migration, fine for three fixed states."
**Values:** `pending`, `shortlisted`, `rejected` (implied by FR-F5 Shortlist/Reject).

## Decision — applicants composite index — 2026-10-14

**Origin:** human addition during the decision above (schema beyond spec, so recorded here).
**Choice:** composite index on `applicants (campaign_id, ai_score)`.
**Rationale (human, verbatim):** "the summary endpoint filters and aggregates by exactly those columns, so that's the index that actually matters."

## 2026-10-14 20:40 — P0 scaffold — applicants enum, migration, model, factory

**Prompt (verbatim excerpt, orchestrator → backend-laravel):**
```text
1. `app/Enums/ApplicantStatus.php`: string-backed enum with cases Pending='pending', Shortlisted='shortlisted', Rejected='rejected'.
2. Migration `create_applicants_table` [...] `id()`, `foreignId('campaign_id')->constrained()->cascadeOnDelete()`, `string('name')`, `unsignedTinyInteger('ai_score')` (0–100), `enum('status', array_column(ApplicantStatus::cases(), 'value'))->default(ApplicantStatus::Pending->value)` — values derived from the PHP enum (single source of truth), `timestamp('applied_at')`, `json('highlights')`, `timestamps()`. composite index `index(['campaign_id', 'ai_score'])`. Nothing else.
3. `app/Models/Applicant.php`: HasFactory, fillable for those columns, casts: status → ApplicantStatus, applied_at → datetime, highlights → array, ai_score → integer. `belongsTo(Campaign::class)`. Add `applicants(): HasMany` to Campaign.
4. `database/factories/ApplicantFactory.php`: [...] highlights → 2–4 short AI-evaluation bullet strings [...]
Verification: [...] a raw `DB::table('applicants')->insert([... 'status' => 'bogus' ...])` is REJECTED by the DB constraint (show the exception).
```

**Raw output (before refactor):**
```php
// backend/app/Enums/ApplicantStatus.php
<?php

namespace App\Enums;

enum ApplicantStatus: string
{
    case Pending = 'pending';
    case Shortlisted = 'shortlisted';
    case Rejected = 'rejected';
}

// backend/database/migrations/2026_10_14_230822_create_applicants_table.php
<?php

use App\Enums\ApplicantStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('applicants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedTinyInteger('ai_score');
            $table->enum('status', array_column(ApplicantStatus::cases(), 'value'))
                ->default(ApplicantStatus::Pending->value);
            $table->timestamp('applied_at');
            $table->json('highlights');
            $table->timestamps();

            $table->index(['campaign_id', 'ai_score']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('applicants');
    }
};

// backend/app/Models/Applicant.php
<?php

namespace App\Models;

use App\Enums\ApplicantStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Applicant extends Model
{
    use HasFactory;

    protected $fillable = ['campaign_id', 'name', 'ai_score', 'status', 'applied_at', 'highlights'];

    protected function casts(): array
    {
        return [
            'status' => ApplicantStatus::class,
            'applied_at' => 'datetime',
            'highlights' => 'array',
            'ai_score' => 'integer',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}

// backend/app/Models/Campaign.php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Campaign extends Model
{
    use HasFactory;

    protected $fillable = ['name'];

    public function applicants(): HasMany
    {
        return $this->hasMany(Applicant::class);
    }
}

// backend/database/factories/ApplicantFactory.php
<?php

namespace Database\Factories;

use App\Enums\ApplicantStatus;
use App\Models\Campaign;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\Applicant>
 */
class ApplicantFactory extends Factory
{
    private const HIGHLIGHTS = [
        'Strong audience engagement rate',
        'Content aligns with brand values',
        'Consistent posting cadence',
        'High-quality visual storytelling',
        'Relevant niche expertise',
        'Previous brand collaborations',
    ];

    public function definition(): array
    {
        return [
            'campaign_id' => Campaign::factory(),
            'name' => fake()->name(),
            'ai_score' => fake()->numberBetween(0, 100),
            'status' => ApplicantStatus::Pending,
            'applied_at' => fake()->dateTimeBetween('-30 days'),
            'highlights' => fake()->randomElements(self::HIGHLIGHTS, fake()->numberBetween(2, 4)),
        ];
    }
}

```

**Verification:** `php artisan test` → 2 passed. Factory creates a campaign with 3 applicants (status cast to the enum, highlights an array of 2–4). Raw insert with `status='bogus'` → `SQLSTATE[23000]: Integrity constraint violation: 19 CHECK constraint failed: status`. Orchestrator independently confirmed `applicants_campaign_id_ai_score_index` exists in sqlite_master.

**Refactor notes:** none. Agent flagged an open gap: `ai_score` has no DB-level range check (0–100). `unsignedTinyInteger` allows 0–255 on MySQL, and SQLite has no limit at all. Raised to the human as a decision instead of being added on the agent's own initiative.

## Decision — ai_score range enforcement — 2026-10-14

**Origin:** gap flagged by `backend-laravel` (`unsignedTinyInteger` allows 0–255 on MySQL and any integer on SQLite).
**Options presented:** A) app validation and factory only; B) DB `CHECK (ai_score BETWEEN 0 AND 100)` in the migration; C) model `saving` hook.
**Choice:** B (human).
**Rationale:** treats `ai_score` the same way as the `status` decision: the database guards writes that bypass Eloquent.

## P0 approval — 2026-10-14

Human approved the P0 scaffold (conditional on applying the ai_score decision above) and authorized starting P1.

## 2026-10-14 20:55 — P0 scaffold — ai_score CHECK constraint

**Prompt (verbatim excerpt, orchestrator → backend-laravel):**
```text
The human decided [...]: the database must enforce `CHECK (ai_score BETWEEN 0 AND 100)`. Edit the existing unreleased migration [...] Laravel 11.57's Blueprint may have no check-constraint modifier [...] If the only working route is invasive (e.g. hand-writing the whole CREATE TABLE in raw SQL and duplicating the Blueprint), STOP and report the options instead of choosing.
```

**Raw output (before refactor):**
```php
// Blueprint has no check() in Laravel 11; rawColumn inlines the CHECK into CREATE TABLE (SQLite + MySQL 8.0.16+).
$table->rawColumn('ai_score', 'tinyint unsigned constraint applicants_ai_score_range check (ai_score between 0 and 100)');
```

**Verification:** SQLite :memory: rejects 150 and -1 (`CHECK constraint failed: applicants_ai_score_range`) and accepts 0 and 100. The status CHECK and the composite index are still there. The agent also tested on MySQL 8.0 in a temporary Docker container it started on its own, without being asked: 150 rejected (error 3819), -1 rejected by unsigned, 0 and 100 accepted. `php artisan test` → 2 passed.

**Refactor notes:** none. Agent found `Blueprint::rawColumn` (a one-line, non-invasive change), so the stop condition didn't apply. Process note: the agent started a Docker container without being asked (outside the prompt's scope); the `mysql:8.0` image is still on the machine.

## P0 closed — 2026-10-14

## 2026-10-14 20:20 — P1 backend — endpoint: route, mock auth middleware, FormRequest, controller, resource, JSON:API error rendering

**Prompt (verbatim excerpt, orchestrator → backend-laravel):**
```text
Delegate phase P1 to the backend-laravel agent: implement FR-B1 to FR-B9 from
docs/frd/FRD-backend.md — the applicant-summary endpoint with mock middleware,
FormRequest, ApplicantSummaryService and a JSON:API response per FR-B7, plus the
FR-B9 PHPUnit tests, run until green. The Architectural Decision Protocol applies.
[...]
- Routing decision A: create `routes/api.php` by hand and register it with `api:` in `withRouting` in `bootstrap/app.php`. Do NOT run `install:api` or add Sanctum.
- Work in blocks: endpoint → metrics → tests. Append one AI_LOG entry per block, with the verbatim prompt and the raw code BEFORE any refactor.
```

**Raw output (before refactor):**
```php
// backend/routes/api.php
<?php

use App\Http\Controllers\ApplicantSummaryController;
use App\Http\Middleware\EnsurePartnerToken;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware(EnsurePartnerToken::class)->group(function () {
    Route::get('campaigns/{campaignId}/applicant-summary', ApplicantSummaryController::class);
});
```

```php
// backend/bootstrap/app.php
<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        //
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // FR-B7: every API error is a JSON:API errors[] document, never HTML or a bare message.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            if ($e instanceof ValidationException) {
                $errors = array_map(fn (string $detail) => [
                    'status' => '422',
                    'title' => 'Invalid parameter',
                    'detail' => $detail,
                ], array_merge(...array_values($e->errors())));

                return new JsonResponse(['errors' => $errors], 422, ['Content-Type' => 'application/vnd.api+json']);
            }

            $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : 500;
            $title = Response::$statusTexts[$status] ?? 'Error';
            // Unexpected errors are still reported (logged); their message is never leaked to the client.
            $detail = $status < 500 && $e->getMessage() !== '' ? $e->getMessage() : $title;

            return new JsonResponse(
                ['errors' => [['status' => (string) $status, 'title' => $title, 'detail' => $detail]]],
                $status,
                ['Content-Type' => 'application/vnd.api+json'],
            );
        });
    })->create();
```

```php
// backend/app/Http/Middleware/EnsurePartnerToken.php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * FR-B2 mock auth: any non-empty X-Partner-Token is accepted.
 */
class EnsurePartnerToken
{
    public function handle(Request $request, Closure $next): Response
    {
        if (blank($request->header('X-Partner-Token'))) {
            abort(401, 'Missing or empty X-Partner-Token header.');
        }

        return $next($request);
    }
}
```

```php
// backend/app/Http/Requests/ApplicantSummaryRequest.php
<?php

namespace App\Http\Requests;

use App\Models\Campaign;
use Illuminate\Foundation\Http\FormRequest;

class ApplicantSummaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** The route parameter is validated together with the query string (FR-B3). */
    public function validationData(): array
    {
        return [...$this->query(), 'campaignId' => $this->route('campaignId')];
    }

    public function rules(): array
    {
        return [
            'campaignId' => ['required', 'integer', 'min:1'],
            'min_score' => ['nullable', 'integer', 'between:0,100'],
            'page' => ['sometimes', 'array'],
            'page.size' => ['sometimes', 'integer', 'between:1,100'],
            'page.number' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    public function attributes(): array
    {
        return [
            'campaignId' => 'campaignId',
            'min_score' => 'min_score',
            'page.size' => 'page[size]',
            'page.number' => 'page[number]',
        ];
    }

    public function campaign(): Campaign
    {
        $id = (int) $this->validated('campaignId');

        return Campaign::find($id) ?? abort(404, "Campaign {$id} not found.");
    }

    public function minScore(): ?int
    {
        $minScore = $this->validated('min_score');

        return $minScore === null ? null : (int) $minScore;
    }

    public function pageSize(): int
    {
        return (int) $this->validated('page.size', 10);
    }

    public function pageNumber(): int
    {
        return (int) $this->validated('page.number', 1);
    }
}
```

```php
// backend/app/Http/Resources/ApplicantResource.php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Applicant */
class ApplicantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'type' => 'applicants',
            'id' => (string) $this->id,
            'attributes' => [
                'name' => $this->name,
                'ai_score' => $this->ai_score,
                'status' => $this->status->value,
                'applied_at' => $this->applied_at->toIso8601ZuluString(),
                'highlights' => $this->highlights,
            ],
        ];
    }
}
```

```php
// backend/app/Http/Controllers/ApplicantSummaryController.php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\ApplicantSummaryRequest;
use App\Http\Resources\ApplicantResource;
use App\Services\ApplicantSummaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;

class ApplicantSummaryController extends Controller
{
    public function __invoke(ApplicantSummaryRequest $request, ApplicantSummaryService $service): JsonResponse
    {
        $campaign = $request->campaign();
        $page = $service->applicants($campaign, $request->minScore(), $request->pageSize(), $request->pageNumber());

        return new JsonResponse([
            'data' => ApplicantResource::collection($page->items())->resolve($request),
            'meta' => [
                'summary' => $service->summary($campaign),
                'pagination' => [
                    'page' => $page->currentPage(),
                    'size' => $page->perPage(),
                    'total_pages' => $page->lastPage(),
                    'total' => $page->total(),
                ],
            ],
            'links' => $this->links($request, $page),
        ], 200, ['Content-Type' => 'application/vnd.api+json'], JSON_PRESERVE_ZERO_FRACTION);
    }

    private function links(ApplicantSummaryRequest $request, LengthAwarePaginator $page): array
    {
        $url = fn (int $number) => $request->fullUrlWithQuery(['page' => ['number' => $number, 'size' => $page->perPage()]]);

        return [
            'first' => $url(1),
            'last' => $url($page->lastPage()),
            'prev' => $page->currentPage() > 1 ? $url($page->currentPage() - 1) : null,
            'next' => $page->hasMorePages() ? $url($page->currentPage() + 1) : null,
        ];
    }
}
```

**Refactor notes:** see the tests block entry below (anything changed after the first test run is recorded there).

## 2026-10-14 20:20 — P1 backend — metrics: ApplicantSummaryService (FR-B4/B5/B6)

**Prompt (verbatim excerpt, orchestrator → backend-laravel):**
```text
- Aggregates (FR-B4) must be computed in the database (one aggregate query), never in a PHP loop. Guard against an empty campaign.
```

**Raw output (before refactor):**
```php
// backend/app/Services/ApplicantSummaryService.php
<?php

namespace App\Services;

use App\Models\Campaign;
use Illuminate\Pagination\LengthAwarePaginator;

class ApplicantSummaryService
{
    public const ELIGIBLE_SCORE = 70;

    public const TOP_SCORE = 90;

    public const TOP_LIMIT = 5;

    /**
     * FR-B4: campaign-wide metrics. One aggregate query plus one LIMITed query; nothing iterated in PHP.
     *
     * @return array{total_applicants: int, eligible_applicants: int, average_ai_score: float, top_applicants: list<array{id: string, name: string, ai_score: int}>}
     */
    public function summary(Campaign $campaign): array
    {
        $totals = $campaign->applicants()
            ->toBase()
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw('SUM(CASE WHEN ai_score >= ? THEN 1 ELSE 0 END) AS eligible', [self::ELIGIBLE_SCORE])
            ->selectRaw('AVG(ai_score) AS average')
            ->first();

        $top = $campaign->applicants()
            ->toBase()
            ->where('ai_score', '>=', self::TOP_SCORE)
            ->orderByDesc('ai_score')
            ->orderBy('id')
            ->limit(self::TOP_LIMIT)
            ->get(['id', 'name', 'ai_score']);

        return [
            'total_applicants' => (int) $totals->total,
            // SUM and AVG are NULL on an empty campaign: coalesce instead of dividing anything in PHP.
            'eligible_applicants' => (int) ($totals->eligible ?? 0),
            'average_ai_score' => round((float) ($totals->average ?? 0), 2),
            'top_applicants' => $top->map(fn (object $row) => [
                'id' => (string) $row->id,
                'name' => $row->name,
                'ai_score' => (int) $row->ai_score,
            ])->all(),
        ];
    }

    /** FR-B5 + FR-B6: the filtered, paginated applicant list, best scores first. */
    public function applicants(Campaign $campaign, ?int $minScore, int $size, int $number): LengthAwarePaginator
    {
        return $campaign->applicants()
            ->when($minScore !== null, fn ($query) => $query->where('ai_score', '>=', $minScore))
            ->orderByDesc('ai_score')
            ->orderBy('id')
            ->paginate($size, ['*'], 'page', $number);
    }
}
```

**Refactor notes:** see the tests block entry below.

## 2026-10-14 20:21 — P1 backend — tests (FR-B9) + demo seeder

**Prompt (verbatim excerpt, orchestrator → backend-laravel):**
```text
[...] plus the FR-B9 PHPUnit tests, run until green. [...]
- Replace the stock ExampleTests with the FR-B9 tests.
```

**Raw output (before refactor):** the files below are the ones as generated, except for the two post-run fixes listed in the refactor notes, which quote the exact original lines.
```php
// backend/tests/Feature/ApplicantSummaryTest.php
<?php

namespace Tests\Feature;

use App\Models\Applicant;
use App\Models\Campaign;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
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

        $this->assertJsonApiError($this->summary((string) $campaign->id, '', []), 401);
    }

    public function test_blank_partner_token_returns_401(): void
    {
        $campaign = Campaign::factory()->create();

        $this->assertJsonApiError($this->summary((string) $campaign->id, '', ['X-Partner-Token' => '   ']), 401);
    }

    public function test_unknown_campaign_returns_404(): void
    {
        $this->assertJsonApiError($this->summary('999'), 404);
    }

    /** @dataProvider malformedCampaignIds */
    public function test_malformed_campaign_id_returns_422(string $campaignId): void
    {
        $this->assertJsonApiError($this->summary($campaignId), 422);
    }

    public static function malformedCampaignIds(): array
    {
        return ['text' => ['abc'], 'zero' => ['0'], 'negative' => ['-1'], 'decimal' => ['1.5']];
    }

    /** @dataProvider invalidQueries */
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
            'page not an object' => ['?page=2'],
        ];
    }

    public function test_min_score_filters_the_list_but_not_the_campaign_summary(): void
    {
        $campaign = $this->campaignWithScores([95, 85, 80, 79, 10]);

        $this->summary((string) $campaign->id, '?min_score=80')
            ->assertOk()
            ->assertJsonPath('data.*.attributes.ai_score', [95, 85, 80])
            ->assertJsonPath('meta.pagination.total', 3)
            ->assertJsonPath('meta.summary.total_applicants', 5);
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
```

```php
// backend/tests/Unit/ApplicantSummaryServiceTest.php
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
```

```php
// backend/database/seeders/DatabaseSeeder.php
<?php

namespace Database\Seeders;

use App\Models\Applicant;
use App\Models\Campaign;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Applicant::factory(40)->for(Campaign::factory())->create();
        Campaign::factory()->create(); // empty campaign: exercises the zeroed summary
    }
}
```

**Refactor notes:**
- First run: 21 passed, 1 failed. **The defect was in the generated test, not the service.** The original line was
  `$this->assertSame(2, $summary['eligible_applicants']); // 90 and 70 (>= 70)` for scores [90, 89, 70, 69]. 89 is also ≥ 70, so the correct value is 3. Fixed the expectation only.
- A manual smoke test (`php artisan serve` + curl against the seeded local SQLite) found a pagination defect the first tests missed. With `page[number]` past the end (e.g. 99 of 4), `links.prev` pointed to page 98, which is also empty. The controller originally had `'prev' => $page->currentPage() > 1 ? $url($page->currentPage() - 1) : null,`. It now clamps with `min(..., $page->lastPage())`, and the pagination test asserts this (the 4 lines from `$beyond` on were added afterwards).
- Seeder: the stock `User` seed was replaced with 40 applicants in campaign 1 plus an empty campaign 2 (FRD-00: "factories and seeders"). No other changes to the endpoint or service from the first run. Stock ExampleTests deleted.
- Smoke-checked, no change needed: `min_score[]=1`, `page[size]=abc`, unknown route and `abc` + `min_score=500` (two errors) all return JSON:API `errors[]` with `application/vnd.api+json`. An empty campaign serializes `"average_ai_score":0.0` (`JSON_PRESERVE_ZERO_FRACTION`).
- Final: `php artisan test` → 22 passed (182 assertions).

## Review findings — P1 backend — 2026-10-14

Reviewer: `code-reviewer`. Scope: P1 backend files plus the P0 migrations, models and factories. `php artisan test` → 22 passed (182 assertions); the only warnings are 2 PHPUnit doc-comment deprecations. The live probes ran on a scratch copy of the SQLite DB (`php artisan serve` + curl). The project DB was not touched.

| # | Severity | file:line | Defect | Fix |
| --- | --- | --- | --- | --- |
| 1 | minor | `app/Http/Requests/ApplicantSummaryRequest.php:28` | `page.number` has no upper bound. `?page[number]=999999999999999999` overflows `(page-1)*size` and returns 200 with **page-1 rows**, while `meta.pagination.page` echoes the huge number. With `PHP_INT_MAX` and size 100, all 40 rows come back. data[] contradicts meta (FR-B6). There is no 500 and no cross-campaign leak. | Add a bound such as `'max:1000000'` (or anything ≤ `intdiv(PHP_INT_MAX, 100)`), so the request gets a 422 per the status map ("Invalid `page[...]` params → 422"). Add one dataset row to `invalidQueries()`. |
| 2 | minor | `app/Http/Controllers/ApplicantSummaryController.php:35` + `bootstrap/app.php:19-21` | `links.*` are built from the request's `Host` header. With `Host: evil.example`, the response contains `links.first = http://evil.example/...`. Host-header injection into absolute URLs that clients follow. | Enable `$middleware->trustHosts()` in `bootstrap/app.php`, or build the links from `config('app.url')`. |
| 3 | minor (test gap) | `tests/Feature/ApplicantSummaryTest.php:130-139` | The test for the contested behaviour (min_score does not touch meta.summary) asserts only `total_applicants`. A regression that filtered `eligible_applicants` / `average_ai_score` / `top_applicants` would still pass. | Assert the whole `meta.summary` block, the same as with no filter (`assertJsonPath('meta.summary', [...])`). |
| 4 | minor (test gap) | `tests/Feature/ApplicantSummaryTest.php:117-128` | Only the rejection side of the boundaries is tested. Nothing proves that `min_score=0`, `min_score=100`, `page[size]=100` and `page[size]=1` are **accepted**, so tightening a rule to `between:1,99` would not fail any test. | Add a `validBoundaryQueries` provider that asserts 200 for those four. |
| 5 | minor (process) | `app/Services/ApplicantSummaryService.php:51-58`, controller `:21` | The two interpretations of silent spec points (summary unfiltered by min_score; order `ai_score DESC, id ASC`) have no `## Decision —` entry. CLAUDE.md lists "deviations from the API contract" as architectural. Neither choice contradicts an FR or the PRD (see verdict), but the summary semantics shapes FR-F (whether the header metrics move with the slider). | Have the orchestrator confirm with the human and record `## Decision — min_score scope / list order — 2026-10-14`. No code change unless the human disagrees. |
| 6 | nit | `bootstrap/app.php:42` | For every HttpException below 500, the raw exception message is passed to `detail`. That exposes internal routes: `"The route api/v1/nope could not be found."` and `"The POST method is not supported for route api/v1/campaigns/1/applicant-summary. Supported methods: GET, HEAD."`. These are harmless today, but any future `abort()`/`ModelNotFoundException` message (e.g. `No query results for model [App\Models\...]`) would leak class names. | Pass through only the messages set in our own code (abort in the middleware or request); everything else uses `$title`. Or map NotFound/MethodNotAllowed to fixed details. |
| 7 | nit | `bootstrap/app.php:44-48` | The handler drops `$e->getHeaders()`, so 405 responses have no `Allow` header (HTTP requires it). | Pass `array_merge($e->getHeaders(), ['Content-Type' => ...])` when `$e` is an `HttpExceptionInterface`. |
| 8 | nit | `app/Http/Requests/ApplicantSummaryRequest.php:24` | `FILTER_VALIDATE_INT` accepts `+1` and `%201` (" 1") as campaignId (200) but rejects `01` (422). This is inconsistent, but harmless after the `(int)` cast. | Optional: `'regex:/^[1-9][0-9]*$/'`. A route `->whereNumber()` would turn these into 404s, so do not use that. |
| 9 | nit | `tests/Feature/ApplicantSummaryTest.php:98,109` | `@dataProvider` doc-comments are deprecated (PHPUnit 12 removes them). They cause the 2 warnings in every run. | Use the `#[DataProvider('...')]` attribute instead. |
| 10 | nit | `tests/Unit/ApplicantSummaryServiceTest.php:12-24` | The "unit" test boots the framework and hits SQLite, which is not isolation in the strict sense (FR-B9 "service in isolation"). This is defensible because the logic *is* SQL. It is isolated from HTTP, which is the useful boundary. | No change. If challenged, say so in TASK_REPORT. |

Categories with **no findings** (checked explicitly):
- **N+1 / PHP-loop aggregation:** none. `summary()` is 1 aggregate query (COUNT, conditional SUM, AVG) plus 1 LIMIT 5 query, and the unit test pins it at 2 queries for 100 applicants. The list uses 2 paginate queries. The `->map` at service `:43` only reshapes ≤ 5 rows. The `(campaign_id, ai_score)` index serves the filter and ORDER BY.
- **Zero-guard:** correct. SUM/AVG NULLs are coalesced, `0.0` is preserved via `JSON_PRESERVE_ZERO_FRACTION`, and both the unit and feature tests cover it. Live, campaign 2 returns zeroed aggregates with `total_pages: 1`.
- **500s on bad input:** none found. Probed `abc`, `0`, `-1`, `1.5`, `01`, `99999999999999999999` (422), `PHP_INT_MAX` (404), `min_score=80.5` / `min_score[]=1` / `page[size][]=1` (422), empty `min_score` (200, treated as absent), POST/DELETE (405 as errors[]), unknown route (404 as errors[]). The only incorrect response is #1, which is wrong data, not a 500.
- **FR-B7 contract drift:** none on the documented paths. `application/vnd.api+json` is on success and on every error, `errors[{status (string), title, detail}]`, `type: "applicants"`, string ids (including in top_applicants), first/last/prev/next links that keep `min_score`, and `meta.pagination` matches the skill example.
- **Security / mass assignment:** no write endpoints, so `$fillable` cannot be exploited. Mock auth matches FR-B2 (blank and whitespace tokens are rejected and tested). 500s never echo the message. Only #2 and #6 are relevant.
- **Fat controller / over-engineering / dead code:** none material. The controller assembles the envelope and links (~30 lines) and there is no logic to extract. No interfaces, repositories or DTOs. The constants are used. `attributes()` is not dead: it changes "min score" to "min_score" and "page.size" to "page[size]" in error details.

**Implementer choices where the FRD is silent:**
1. *`min_score` filters data[] and pagination, not meta.summary* — **does not contradict** any FR or PRD text. FR-B4 defines `meta.summary` as campaign metrics, and PRD-E1 frames it as "a campaign's applicant summary so I can evaluate its performance". FR-B5 defines `min_score` only as a filter with 0–100 validation. "Work combined" in PRD-E1 refers to min_score + page params, and that holds. Leaving the summary unfiltered also keeps it a stable campaign KPI and lets it reuse the same 2 queries. The only consequence: the FR-F header metrics will not change with the slider, and P2 must not expect them to (see #5).
2. *Order `ai_score DESC, id ASC`* — **does not contradict** anything. No FR specifies list order. It matches `top_applicants` "desc" in FR-B4, and the `id` tiebreak makes pagination deterministic (otherwise rows with equal scores could repeat or be skipped across pages). Tested in the 200 case.

**Verdict:** no blockers, no majors. The P1 backend meets FR-B1–B9: the aggregation runs in the database, the zero-guard is correct, every error path I could reach returns a JSON:API `errors[]` with the right status, and the tests would fail on the regressions that matter (thresholds, cap, zeroed state, query count, link targets). Nothing has to loop back. #1–#4 are cheap fixes worth batching before qa-gate (one validation rule, one middleware line, two test tightenings). #5 is the orchestrator's job to confirm with the human. #6–#10 are optional.

## 2026-10-14 20:26 — P1 backend — review fixes

**Prompt (verbatim):**
```text
P1 review loop-back for /Users/fernandoviviurka/Desktop/Projetos/b2b-fullstack-task-submission/backend. Read `## Review findings — P1 backend — 2026-10-14` in docs/AI_LOG.md and fix exactly these findings:
- #1: add a max on `page.number` in ApplicantSummaryRequest (e.g. `max:1000000`) and a matching row in the invalid-query provider.
- #2: pagination links must not come from an untrusted Host header. Use Laravel's built-in `$middleware->trustHosts()` in bootstrap/app.php (a framework feature, not a new package). Add a test that `Host: evil.example` does not end up in `links`. Note that `trustHosts` may be a no-op when running locally or under tests; check this in vendor. If it doesn't protect in tests, build the links from `config('app.url')` instead.
- #3: the min_score/summary test must assert the whole `meta.summary` block.
- #4: add a provider of valid boundary values (min_score 0 and 100, page[size] 1 and 100) that expects 200.
- #6: for HTTP errors below 500, keep our own `abort()` messages (401/404 campaign) but replace framework messages (route not found and similar) with a generic detail. No route paths in `detail`.
- #7: merge `$e->getHeaders()` into the error response (the 405 `Allow` header).
- #9: switch from `@dataProvider` doc-comments to `#[DataProvider]` attributes.
Skip #8 and #10. Don't change #5 (the min_score scope and the list order); it's pending with the human.

Log per the ai-evidence-log skill: one AI_LOG entry `P1 backend — review fixes` with this prompt and the diff of each change. Run `php artisan test` until it's green with no deprecations. Don't run code-reviewer or qa-gate. Report: the changes per finding and the final test output.
```

**Notes per finding:**
- **#1:** `page.number` is now `between:1,1000000`. The invalid provider has a row for `1000001`, and the valid provider has a row for `1000000`.
- **#2:** `TrustHosts::shouldSpecifyTrustedHosts()` (vendor `Illuminate/Http/Middleware/TrustHosts.php:100-103`) returns false when `environment('local')` or `runningUnitTests()`. That means `trustHosts()` would give no protection in this project's `.env` (APP_ENV=local) or under tests. I used the fallback the prompt names: links are built from `config('app.url')` + `$request->path()` + `Arr::query(...)`, and `trustHosts()` was not added. New test: a request to `http://evil.example/...` with `Host: evil.example` gets links that start with APP_URL. Verified that it fails against the original controller (`http://evil.example/...` came back).
- **#3:** the min_score test asserts the whole `meta.summary` with `assertSame` (5 / 4 / 69.8 / one top applicant).
- **#4:** added the `validBoundaryQueries` provider (min_score 0 and 100, page[size] 1 and 100, page[number] 1000000) → 200.
- **#6:** `abort()` cannot be told apart from framework errors: `abort(404)` and route-not-found both throw a plain `NotFoundHttpException` from vendor. I added the marker `App\Exceptions\ApiException extends HttpException`, and our two raises (middleware 401, campaign 404) throw it. The handler passes `getMessage()` through only for `ApiException` below 500. Everything else gets the status title ("Not Found", "Method Not Allowed"). Tests pin both of our details and the generic framework details.
- **#7:** the handler merges `$e->getHeaders()` for `HttpExceptionInterface`, and our `Content-Type` wins. Tested: 405 carries `Allow: GET, HEAD`.
- **#9:** both providers use `#[DataProvider(...)]`. The 2 deprecation warnings are gone.
- #5, #8 and #10 are untouched, as instructed.

**Diff (raw):**
```diff
--- a/app/Http/Requests/ApplicantSummaryRequest.php
+++ b/app/Http/Requests/ApplicantSummaryRequest.php
@@ -2,6 +2,7 @@
 
 namespace App\Http\Requests;
 
+use App\Exceptions\ApiException;
 use App\Models\Campaign;
 use Illuminate\Foundation\Http\FormRequest;
 
@@ -25,7 +26,8 @@
             'min_score' => ['nullable', 'integer', 'between:0,100'],
             'page' => ['sometimes', 'array'],
             'page.size' => ['sometimes', 'integer', 'between:1,100'],
-            'page.number' => ['sometimes', 'integer', 'min:1'],
+            // The cap keeps (number - 1) * size far from integer overflow.
+            'page.number' => ['sometimes', 'integer', 'between:1,1000000'],
         ];
     }
 
@@ -43,7 +45,7 @@
     {
         $id = (int) $this->validated('campaignId');
 
-        return Campaign::find($id) ?? abort(404, "Campaign {$id} not found.");
+        return Campaign::find($id) ?? throw new ApiException(404, "Campaign {$id} not found.");
     }
 
     public function minScore(): ?int
--- a/app/Http/Middleware/EnsurePartnerToken.php
+++ b/app/Http/Middleware/EnsurePartnerToken.php
@@ -2,6 +2,7 @@
 
 namespace App\Http\Middleware;
 
+use App\Exceptions\ApiException;
 use Closure;
 use Illuminate\Http\Request;
 use Symfony\Component\HttpFoundation\Response;
@@ -14,7 +15,7 @@
     public function handle(Request $request, Closure $next): Response
     {
         if (blank($request->header('X-Partner-Token'))) {
-            abort(401, 'Missing or empty X-Partner-Token header.');
+            throw new ApiException(401, 'Missing or empty X-Partner-Token header.');
         }
 
         return $next($request);
--- a/app/Http/Controllers/ApplicantSummaryController.php
+++ b/app/Http/Controllers/ApplicantSummaryController.php
@@ -7,6 +7,7 @@
 use App\Services\ApplicantSummaryService;
 use Illuminate\Http\JsonResponse;
 use Illuminate\Pagination\LengthAwarePaginator;
+use Illuminate\Support\Arr;
 
 class ApplicantSummaryController extends Controller
 {
@@ -32,7 +33,9 @@
 
     private function links(ApplicantSummaryRequest $request, LengthAwarePaginator $page): array
     {
-        $url = fn (int $number) => $request->fullUrlWithQuery(['page' => ['number' => $number, 'size' => $page->perPage()]]);
+        // Built from APP_URL, never from the client-controlled Host header (TrustHosts is off under local/testing).
+        $base = rtrim(config('app.url'), '/').'/'.$request->path();
+        $url = fn (int $number) => $base.'?'.Arr::query([...$request->query(), 'page' => ['number' => $number, 'size' => $page->perPage()]]);
 
         return [
             'first' => $url(1),
--- a/bootstrap/app.php
+++ b/bootstrap/app.php
@@ -1,5 +1,6 @@
 <?php
 
+use App\Exceptions\ApiException;
 use Illuminate\Foundation\Application;
 use Illuminate\Foundation\Configuration\Exceptions;
 use Illuminate\Foundation\Configuration\Middleware;
@@ -38,13 +39,15 @@
 
             $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : 500;
             $title = Response::$statusTexts[$status] ?? 'Error';
-            // Unexpected errors are still reported (logged); their message is never leaked to the client.
-            $detail = $status < 500 && $e->getMessage() !== '' ? $e->getMessage() : $title;
+            // Only messages we wrote reach the client; framework messages (route paths, model classes) and 500s get the generic title.
+            $detail = $e instanceof ApiException && $status < 500 ? $e->getMessage() : $title;
+            // Keep the exception's own headers, e.g. `Allow` on a 405.
+            $headers = $e instanceof HttpExceptionInterface ? $e->getHeaders() : [];
 
             return new JsonResponse(
                 ['errors' => [['status' => (string) $status, 'title' => $title, 'detail' => $detail]]],
                 $status,
-                ['Content-Type' => 'application/vnd.api+json'],
+                [...$headers, 'Content-Type' => 'application/vnd.api+json'],
             );
         });
     })->create();
--- a/tests/Feature/ApplicantSummaryTest.php
+++ b/tests/Feature/ApplicantSummaryTest.php
@@ -6,6 +6,7 @@
 use App\Models\Campaign;
 use Illuminate\Foundation\Testing\RefreshDatabase;
 use Illuminate\Testing\TestResponse;
+use PHPUnit\Framework\Attributes\DataProvider;
 use Tests\TestCase;
 
 class ApplicantSummaryTest extends TestCase
@@ -80,7 +81,10 @@
     {
         $campaign = Campaign::factory()->create();
 
-        $this->assertJsonApiError($this->summary((string) $campaign->id, '', []), 401);
+        $response = $this->summary((string) $campaign->id, '', []);
+
+        $this->assertJsonApiError($response, 401);
+        $response->assertJsonPath('errors.0.detail', 'Missing or empty X-Partner-Token header.');
     }
 
     public function test_blank_partner_token_returns_401(): void
@@ -92,10 +96,13 @@
 
     public function test_unknown_campaign_returns_404(): void
     {
-        $this->assertJsonApiError($this->summary('999'), 404);
+        $response = $this->summary('999');
+
+        $this->assertJsonApiError($response, 404);
+        $response->assertJsonPath('errors.0.detail', 'Campaign 999 not found.');
     }
 
-    /** @dataProvider malformedCampaignIds */
+    #[DataProvider('malformedCampaignIds')]
     public function test_malformed_campaign_id_returns_422(string $campaignId): void
     {
         $this->assertJsonApiError($this->summary($campaignId), 422);
@@ -106,7 +113,7 @@
         return ['text' => ['abc'], 'zero' => ['0'], 'negative' => ['-1'], 'decimal' => ['1.5']];
     }
 
-    /** @dataProvider invalidQueries */
+    #[DataProvider('invalidQueries')]
     public function test_invalid_query_parameters_return_422(string $query): void
     {
         $campaign = Campaign::factory()->create();
@@ -123,21 +130,80 @@
             'page size above 100' => ['?page[size]=101'],
             'page size zero' => ['?page[size]=0'],
             'page number zero' => ['?page[number]=0'],
+            'page number above cap' => ['?page[number]=1000001'],
             'page not an object' => ['?page=2'],
         ];
     }
 
+    #[DataProvider('validBoundaryQueries')]
+    public function test_boundary_query_values_are_accepted(string $query): void
+    {
+        $campaign = Campaign::factory()->create();
+
+        $this->summary((string) $campaign->id, $query)->assertOk();
+    }
+
+    public static function validBoundaryQueries(): array
+    {
+        return [
+            'min_score 0' => ['?min_score=0'],
+            'min_score 100' => ['?min_score=100'],
+            'page size 1' => ['?page[size]=1'],
+            'page size 100' => ['?page[size]=100'],
+            'page number at cap' => ['?page[number]=1000000'],
+        ];
+    }
+
     public function test_min_score_filters_the_list_but_not_the_campaign_summary(): void
     {
         $campaign = $this->campaignWithScores([95, 85, 80, 79, 10]);
 
-        $this->summary((string) $campaign->id, '?min_score=80')
+        $response = $this->summary((string) $campaign->id, '?min_score=80')
             ->assertOk()
             ->assertJsonPath('data.*.attributes.ai_score', [95, 85, 80])
-            ->assertJsonPath('meta.pagination.total', 3)
-            ->assertJsonPath('meta.summary.total_applicants', 5);
+            ->assertJsonPath('meta.pagination.total', 3);
+
+        $top = $campaign->applicants()->firstWhere('ai_score', 95);
+        $this->assertSame([
+            'total_applicants' => 5,
+            'eligible_applicants' => 4,
+            'average_ai_score' => 69.8, // 349 / 5
+            'top_applicants' => [
+                ['id' => (string) $top->id, 'name' => $top->name, 'ai_score' => 95],
+            ],
+        ], $response->json('meta.summary'));
     }
 
+    public function test_links_ignore_a_spoofed_host_header(): void
+    {
+        $campaign = $this->campaignWithScores(range(50, 61));
+
+        $response = $this->get("http://evil.example/api/v1/campaigns/{$campaign->id}/applicant-summary?page[size]=5&page[number]=2", [
+            'X-Partner-Token' => 'partner-demo',
+            'Host' => 'evil.example',
+        ]);
+
+        $response->assertOk();
+        foreach (['first', 'last', 'prev', 'next'] as $link) {
+            $this->assertStringStartsWith(rtrim(config('app.url'), '/').'/api/v1/', $response->json("links.{$link}"), $link);
+            $this->assertStringNotContainsString('evil.example', $response->json("links.{$link}"), $link);
+        }
+    }
+
+    public function test_framework_errors_hide_internals_and_keep_their_headers(): void
+    {
+        $campaign = Campaign::factory()->create();
+
+        $notFound = $this->get('/api/v1/nope', ['X-Partner-Token' => 'partner-demo']);
+        $this->assertJsonApiError($notFound, 404);
+        $notFound->assertJsonPath('errors.0.detail', 'Not Found');
+
+        $notAllowed = $this->post("/api/v1/campaigns/{$campaign->id}/applicant-summary", [], ['X-Partner-Token' => 'partner-demo']);
+        $this->assertJsonApiError($notAllowed, 405);
+        $notAllowed->assertJsonPath('errors.0.detail', 'Method Not Allowed')
+            ->assertHeader('Allow', 'GET, HEAD');
+    }
+
     public function test_paginates_with_links(): void
     {
         $campaign = $this->campaignWithScores(range(50, 61));
--- a/app/Exceptions/ApiException.php
+++ b/app/Exceptions/ApiException.php
@@ -0,0 +1,8 @@
+<?php
+
+namespace App\Exceptions;
+
+use Symfony\Component\HttpKernel\Exception\HttpException;
+
+/** An HTTP error raised by our own code: its message is written for clients and is safe to expose as `detail`. */
+class ApiException extends HttpException {}
```

**Result:** `php artisan test` → 30 passed (229 assertions), 0 deprecations/warnings.

## Decision — min_score scope vs meta.summary — 2026-10-14

**Origin:** code-reviewer finding #5 (an API-contract reading the FRD doesn't settle).
**Options presented:** A) summary stays campaign-wide, the filter narrows only data[] and pagination; B) the filter also applies to the summary; C) campaign-wide summary + extra `meta.filtered_total`.
**Choice:** A (human).
**Rationale:** the most literal reading of FR-B4/PRD-E1 ("evaluate its performance"); filtered metrics would be meaningless (eligible = total when min_score ≥ 70); `meta.pagination.total` already gives the filtered count. P2 consequence: the header metrics don't move with the slider.

## Decision — applicant list order — 2026-10-14

**Origin:** code-reviewer finding #5 (no FR defines an order; pagination needs a stable one).
**Options presented:** A) `ai_score DESC, id ASC`; B) `applied_at DESC, id DESC`; C) a client-chosen `?sort=` parameter.
**Choice:** A (human).
**Rationale:** fits the review/match workflow and uses the `(campaign_id, ai_score)` index; the id tiebreak keeps rows from repeating or vanishing between pages.

## QA gate — P1 backend — 2026-10-14

Gate: `qa-gate`. Suite: `cd backend && php artisan test` → **30 passed (229 assertions), 0 failures, 0 warnings/deprecations** (Unit `ApplicantSummaryServiceTest` 4, Feature `ApplicantSummaryTest` 26). Live probes: `php artisan serve --port=8765` against a scratch SQLite copy (`migrate:fresh --seed`: campaign 1 = 40 applicants, campaign 2 = empty). The server was stopped afterwards and the scratch DB deleted. `backend/database/database.sqlite` was not touched. No code was modified.

### FR rows

| FR id | Verdict | Evidence | Note |
| --- | --- | --- | --- |
| FR-B1 | PASS | `routes/api.php:7-8` (`v1` prefix, `campaigns/{campaignId}/applicant-summary`); `bootstrap/app.php:16` registers it via `withRouting(api:)`; invokable `app/Http/Controllers/ApplicantSummaryController.php:14-32`; logic in `app/Services/ApplicantSummaryService.php:21,52` | The controller only delegates, builds the envelope and builds the links |
| FR-B2 | PASS | `app/Http/Middleware/EnsurePartnerToken.php:17-18` (`blank()` → 401); tests `test_missing_partner_token_returns_401`, `test_blank_partner_token_returns_401`; live: no header / empty header → 401 `errors[]` | |
| FR-B3 | PASS | `app/Http/Requests/ApplicantSummaryRequest.php:17-25` (`campaignId` required\|integer\|min:1); `:48` 404 via `ApiException`; renderer `bootstrap/app.php:30-51`; tests `test_malformed_campaign_id_returns_422` ×4 (abc, 0, -1, 1.5), `test_unknown_campaign_returns_404`; live `/abc` → 422, `/999` → 404 | No 500 on any probe |
| FR-B4 | PASS | `ApplicantSummaryService.php:23-48`: COUNT, `SUM(CASE ai_score>=70)`, AVG coalesced to 0 and `round(...,2)`, top ≥90 `orderByDesc` `limit(5)`; `JSON_PRESERVE_ZERO_FRACTION` controller `:31`; tests `test_computes_aggregates_at_threshold_boundaries`, `test_top_applicants_are_capped_at_five_in_descending_order`, `test_empty_campaign_is_zeroed_without_dividing_by_zero`, `test_returns_applicants_and_database_aggregates` (72.86 = 510/7); live campaign 2 → `"average_ai_score":0.0` | |
| FR-B5 | PASS | `ApplicantSummaryRequest.php:26` (`nullable\|integer\|between:0,100`); service `:55`; tests `invalidQueries` (101, -1, abc → 422), `validBoundaryQueries` (0, 100 → 200), `test_min_score_filters_the_list_but_not_the_campaign_summary`; live `min_score=101`/`abc` → 422 | |
| FR-B6 | PASS | `ApplicantSummaryRequest.php:28-30,58-66` (size 1–100, default 10; number ≥1, default 1); controller `:23-28` `meta.pagination`, `:34-46` first/last/prev/next; test `test_paginates_with_links`; live `min_score=80&page[size]=3&page[number]=2` → page 2/3, total 8, links keep `min_score` | |
| FR-B7 | PASS | `ApplicantResource.php:13-23` (`type: "applicants"`, string `id`, `attributes`); `bootstrap/app.php:30-51` errors `[{status (string), title, detail}]`; `Content-Type: application/vnd.api+json` controller `:31` and handler `:37,50`; helper `assertJsonApiError` asserts the header on every error test; live: header present on 200/401/404/405/422 | |
| FR-B8 | PASS | Controller → `ApplicantSummaryRequest` (FormRequest) → `ApplicantSummaryService` → Eloquent query builder; aggregation in SQL `ApplicantSummaryService.php:23-36`; `test_summary_uses_two_queries_regardless_of_applicant_count` (2 queries for 100 rows); `EXPLAIN QUERY PLAN` → `SEARCH applicants USING INDEX applicants_campaign_id_ai_score_index` | `->map` at `:43` only reshapes ≤5 rows |
| FR-B9 | PASS | Feature: 200+aggregates `test_returns_applicants_and_database_aggregates`; 401 ×2; 404 `test_unknown_campaign_returns_404`; 422 ID ×4 and `min_score` ×3 (+page ×5); empty `test_empty_campaign_returns_zeroed_aggregates`. Unit: `Tests\Unit\ApplicantSummaryServiceTest` ×4 | The unit test uses SQLite in-memory (the service *is* SQL). It is isolated from HTTP (review #10 accepted) |

### PRD-E1 acceptance criteria

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| JSON:API with `data[]`, `meta.summary`, pagination `links` | PASS | live 200 body; `test_returns_applicants_and_database_aggregates` structure assertion |
| 401 / 422 / 404 as `errors[]` | PASS | the tests and live probes cited in FR-B2/B3 |
| Summary carries total, eligible, average, top-tier | PASS | FR-B4 evidence |
| `min_score` + `page[size]` + `page[number]` combined | PASS | live `?min_score=80&page[size]=3&page[number]=2` → 3 rows (85, 83, 81), `total: 8`, `total_pages: 3` |
| Empty campaign → 200, zeroed, no division by zero | PASS | `test_empty_campaign_returns_zeroed_aggregates`, unit zero test, live campaign 2 |

### Recorded human decisions

| Decision | Verdict | Evidence |
| --- | --- | --- |
| Hand-made `routes/api.php`, no Sanctum | PASS | `bootstrap/app.php:16`; `composer.json` require has no `laravel/sanctum`; `vendor/laravel/` has no sanctum; no `personal_access_tokens` migration; grep for `sanctum` in app/config/routes/database finds nothing |
| Status enum + DB CHECK | PASS | `app/Enums/ApplicantStatus.php`; migration `:18` `enum(..., array_column(ApplicantStatus::cases(), 'value'))`; scratch DB DDL `check ("status" in ('pending','shortlisted','rejected'))`; raw insert `'bogus'` → `CHECK constraint failed: status` |
| `ai_score` 0–100 CHECK | PASS | migration `:17` `applicants_ai_score_range check (ai_score between 0 and 100)`; raw insert 101 → `CHECK constraint failed: applicants_ai_score_range` |
| `(campaign_id, ai_score)` index | PASS | migration `:24`; `sqlite_master` has `applicants_campaign_id_ai_score_index`; used by the query plan |
| `min_score` leaves `meta.summary` campaign-wide | PASS | `summary(Campaign)` takes no filter (service `:21`); `test_min_score_filters_the_list_but_not_the_campaign_summary` asserts the full block; live `min_score=80` → `total_applicants: 40`, list `total: 8` |
| Order `ai_score DESC, id ASC` | PASS | service `:56-57` (and `:33-34` for top); test asserts `[95,91,90,85,70,69,10]`; live page 2 ordering 85, 83, 81 |

### Code-reviewer findings (P1)

| # | Verdict | Evidence |
| --- | --- | --- |
| 1 page[number] overflow | FIXED | `ApplicantSummaryRequest.php:30` `between:1,1000000`; datasets `page number above cap` (422) and `page number at cap` (200); live `page[number]=999999999999999999` → 422 |
| 2 Host-header injection in links | FIXED | controller `:37` builds links from `config('app.url')`; `test_links_ignore_a_spoofed_host_header`; live `Host: evil.example` → links `http://localhost/...` |
| 3 min_score test asserted only the total | FIXED | `ApplicantSummaryTest.php:167-174` `assertSame` on the whole `meta.summary` |
| 4 no acceptance-side boundary tests | FIXED | `validBoundaryQueries` provider `:138-155` (min_score 0/100, size 1/100, number at cap) |
| 6 framework messages leaked in `detail` | FIXED | `bootstrap/app.php:43` passes the message only for `ApiException` <500; `test_framework_errors_hide_internals_and_keep_their_headers`; live `/api/v1/nope` → detail `Not Found`, POST → `Method Not Allowed` |
| 7 `Allow` header dropped on 405 | FIXED | `bootstrap/app.php:45,50` merges `getHeaders()`; test asserts `Allow: GET, HEAD`; live 405 carries `Allow: GET, HEAD` |
| 9 deprecated `@dataProvider` | FIXED | `#[DataProvider]` attributes at `ApplicantSummaryTest.php:105,116,138`; no `@dataProvider` left; suite runs with 0 deprecations |

**Overall: PASS.** All FR-B1–B9 rows, all PRD-E1 criteria, all 6 recorded decisions and all 7 targeted review findings are verified. P1 backend may close.

## P1 closed — 2026-10-14

code-reviewer: no blockers or majors; findings #1–#4, #6, #7 and #9 fixed. qa-gate: PASS on FR-B1–B9 and PRD-E1. Orchestrator re-ran `php artisan test`: green.

## Decision — Tailwind integration in Nuxt 3 — 2026-10-14

**Options presented:** A) Tailwind v4 via the `@tailwindcss/vite` plugin + one CSS file; B) `@nuxtjs/tailwindcss` module (Tailwind v3); C) CDN script tag.
**Choice:** A (human).
**Rationale:** the current Tailwind major with the least extra machinery: one official Tailwind package, no config file, no extra Nuxt module layer.

## Decision — Vitest setup for Nuxt 3 components — 2026-10-14

**Options presented:** A) plain Vitest + `@vitejs/plugin-vue` + `happy-dom`, explicit `vue` imports in tested code, `$fetch` stubbed in tests; B) `@nuxt/test-utils` with `environment: 'nuxt'`; C) Vitest + `unplugin-auto-import` faking Nuxt's auto-imports.
**Choice:** A (human).
**Rationale:** fastest to get green inside the timebox; explicit imports keep the code fully typed (no `any`) with no Nuxt runtime in tests. Packages: `vitest`, `@vue/test-utils`, `@vitejs/plugin-vue`, `happy-dom`.

## P2 authorized — 2026-10-14

## 2026-10-14 20:41 — P2 frontend — contract: types/applicant.ts (FR-F2)

**Prompt (verbatim):**
```text
Phase P2 (frontend) in /Users/fernandoviviurka/Desktop/Projetos/b2b-fullstack-task-submission/frontend (Nuxt 3.21.11 already scaffolded, TS strict). Implement FR-F1 to FR-F9 from docs/frd/FRD-frontend.md. Follow the optimistic-ui-vue, jsonapi-laravel and ai-evidence-log skills. The Architectural Decision Protocol applies.

Read the `## Decision` entries in docs/AI_LOG.md first. In particular:
- **Tailwind:** v4 via `@tailwindcss/vite` in nuxt.config.ts `vite.plugins`, with one CSS file (`assets/css/main.css` with `@import "tailwindcss";`) registered in `css`. No `@nuxtjs/tailwindcss`, no config file.
- **Tests:** plain Vitest with `vitest`, `@vue/test-utils`, `@vitejs/plugin-vue` and `happy-dom` as devDependencies; `vitest.config.ts` with the vue plugin, the happy-dom environment and a `~` alias to the project root; an `npm test` script. Code under test imports `ref`, `computed` and so on explicitly from `vue`; tests stub `$fetch`/fetch. Don't use `@nuxt/test-utils` or `unplugin-auto-import`.
- **Backend contract:** the real backend contract is in backend/ (P1 closed). Mirror it exactly in `types/applicant.ts`: `data[]` items with `type: "applicants"`, a string `id` and `attributes` (`name`, `ai_score`, `status`: `'pending' | 'shortlisted' | 'rejected'`, `applied_at`, `highlights`), plus `meta.summary`, `meta.pagination` and `links`. Read backend/app/Http/Resources/ApplicantResource.php and the controller to get the exact shapes.
- **min_score and summary:** `min_score` does NOT change `meta.summary`. The summary stays campaign-wide, so the header metrics don't move with the filter. Show the filtered count from `meta.pagination.total`.
- **List order:** `ai_score` DESC, then `id` ASC.

Order of work, one AI_LOG entry per block with the verbatim prompt and the raw code BEFORE any refactor:
1. Contract in `types/applicant.ts`.
2. `useApplicantSummary()` composable exposing `data`, `pending`, `error`, plus the fixture/mock handler that follows the FR-B7 contract (FRD-00: "Frontend data source: Fixture/mocked handler").
3. `components/ApplicantReviewCard.vue`, `<script setup lang="ts">`. It needs:
   - a badge that uses color plus a text label (FR-F3);
   - a formatted date and 2–4 bullets (FR-F4);
   - optimistic Shortlist/Reject with disabled buttons and a rollback message (FR-F5);
   - a skeleton and an empty state with a clear-filter action (FR-F6);
   - a filter debounced at about 300 ms (FR-F7).
   Wire it into app.vue so it renders.
4. Vitest tests (FR-F9): data renders; the filter or a button changes the DOM; the rollback path on a failed request.

Zero `any`. The status mutation endpoint doesn't exist in the backend, and it isn't in the FRD, so mock it. Don't add a backend route. If anything requires a decision not frozen in FRD-00, an FR row or the AI_LOG decisions (another package, a state library, a contract deviation), STOP and report 3 options instead of implementing. Don't run code-reviewer or qa-gate yourself.

Done means `npx vitest run` is green and `npm run build` succeeds. Report: the files created or changed, packages added with versions, the final test and build output, and the AI_LOG entries you added.
```

**Raw output (before refactor):**

`frontend/types/applicant.ts`

```ts
// Mirrors the FR-B7 contract served by backend/ (ApplicantResource + ApplicantSummaryController).

export type ApplicantStatus = 'pending' | 'shortlisted' | 'rejected'

export interface ApplicantAttributes {
  name: string
  ai_score: number
  status: ApplicantStatus
  /** ISO-8601 UTC, e.g. "2026-10-01T14:30:00Z" */
  applied_at: string
  highlights: string[]
}

export interface ApplicantResource {
  type: 'applicants'
  id: string
  attributes: ApplicantAttributes
}

export interface TopApplicant {
  id: string
  name: string
  ai_score: number
}

/** Campaign-wide: does not change with min_score. */
export interface ApplicantSummary {
  total_applicants: number
  eligible_applicants: number
  average_ai_score: number
  top_applicants: TopApplicant[]
}

export interface Pagination {
  page: number
  size: number
  total_pages: number
  /** Count after min_score is applied. */
  total: number
}

export interface PaginationLinks {
  first: string
  last: string
  prev: string | null
  next: string | null
}

export interface ApplicantSummaryDocument {
  data: ApplicantResource[]
  meta: {
    summary: ApplicantSummary
    pagination: Pagination
  }
  links: PaginationLinks
}

/** Response of the mocked PATCH status endpoint (not part of the backend). */
export interface ApplicantDocument {
  data: ApplicantResource
}

export interface JsonApiError {
  status: string
  title: string
  detail: string
}

export interface JsonApiErrorDocument {
  errors: JsonApiError[]
}
```

## 2026-10-14 20:43 — P2 frontend — useApplicantSummary composable + FR-B7 mock handlers (FR-F7/FR-F8)

**Prompt (verbatim):**
```text
2. `useApplicantSummary()` composable exposing `data`, `pending`, `error`, plus the fixture/mock handler that follows the FR-B7 contract (FRD-00: "Frontend data source: Fixture/mocked handler").
```

**Raw output (before refactor):**

`frontend/composables/useApplicantSummary.ts`

```ts
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { ApplicantSummaryDocument, JsonApiErrorDocument } from '~/types/applicant'

export const FILTER_DEBOUNCE_MS = 300
// ponytail: no pager UI, first 100 (backend max page[size]) filtered rows only; add a pager when a campaign outgrows that.
const PAGE_SIZE = 100

function isErrorDocument(value: unknown): value is JsonApiErrorDocument {
  return typeof value === 'object' && value !== null && 'errors' in value && Array.isArray(value.errors)
}

/** JSON:API `errors[0].detail` when the API sent one, otherwise a generic message. */
export function errorMessage(e: unknown, fallback: string): string {
  const body: unknown = typeof e === 'object' && e !== null && 'data' in e ? e.data : undefined
  return isErrorDocument(body) && body.errors[0] ? body.errors[0].detail : fallback
}

export function useApplicantSummary(campaignId: number, minScore: Ref<number>) {
  const data = ref<ApplicantSummaryDocument | null>(null)
  const pending = ref(true)
  const error = ref<string | null>(null)
  let latest = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function refresh(): Promise<void> {
    const request = ++latest
    pending.value = true
    error.value = null
    try {
      const document = await $fetch<ApplicantSummaryDocument>(`/api/v1/campaigns/${campaignId}/applicant-summary`, {
        query: { min_score: minScore.value, 'page[size]': PAGE_SIZE },
      })
      if (request === latest) data.value = document
    } catch (e) {
      if (request === latest) error.value = errorMessage(e, 'Could not load applicants.')
    } finally {
      // An older, slower response must not overwrite a newer filter's result.
      if (request === latest) pending.value = false
    }
  }

  watch(minScore, () => {
    clearTimeout(timer)
    timer = setTimeout(refresh, FILTER_DEBOUNCE_MS)
  })
  onMounted(refresh)
  onBeforeUnmount(() => clearTimeout(timer))

  return { data, pending, error, refresh }
}
```

`frontend/server/mock/applicant-summary.ts`

```ts
// Fixture + pure builder mirroring backend ApplicantSummaryController/Service (FR-B4–B7).
// Used by the Nitro mock routes and by the Vitest suite.
import type { ApplicantResource, ApplicantSummaryDocument } from '~/types/applicant'

export const MOCK_CAMPAIGN_ID = '1'

const ELIGIBLE_SCORE = 70
const TOP_SCORE = 90
const TOP_LIMIT = 5

const applicant = (id: number, name: string, ai_score: number, applied_at: string, highlights: string[]): ApplicantResource => ({
  type: 'applicants',
  id: String(id),
  attributes: { name, ai_score, status: 'pending', applied_at, highlights },
})

// Module state: the PATCH mock mutates it so a refetch keeps the new status (resets on server restart).
export const applicants: ApplicantResource[] = [
  applicant(1, 'Jane Doe', 96, '2026-10-01T14:30:00Z', ['Strong portfolio', 'Relevant internship', 'Excellent written English', 'Led a student design team', 'Published case study']),
  applicant(2, 'Carlos Mendes', 91, '2026-10-02T09:12:00Z', ['Two years of B2B sales', 'Fluent in Spanish and English', 'Exceeded quota three quarters running']),
  applicant(3, 'Aisha Khan', 90, '2026-10-03T16:45:00Z', ['Data analysis coursework', 'Built a dashboard used by 200 students']),
  applicant(4, 'Liam O\'Brien', 88, '2026-10-02T11:00:00Z', ['Customer support background', 'Clear and structured answers', 'Available immediately']),
  applicant(5, 'Mei Tanaka', 84, '2026-10-04T08:20:00Z', ['Marketing internship', 'Social media growth case', 'Bilingual']),
  applicant(6, 'Noah Schmidt', 77, '2026-10-05T13:05:00Z', ['Event coordination', 'Good teamwork examples']),
  applicant(7, 'Sofia Rossi', 70, '2026-10-05T19:40:00Z', ['Hospitality experience', 'Positive references']),
  applicant(8, 'Ethan Brown', 69, '2026-10-06T10:10:00Z', ['Enthusiastic cover letter', 'Limited relevant experience']),
  applicant(9, 'Fatima Ali', 58, '2026-10-07T07:55:00Z', ['Retail background', 'Answers lacked detail']),
  applicant(10, 'Lucas Silva', 42, '2026-10-08T15:30:00Z', ['Incomplete application', 'No portfolio provided']),
]

export interface SummaryParams {
  minScore: number | null
  size: number
  number: number
}

export function buildApplicantSummary(all: ApplicantResource[], params: SummaryParams, basePath: string): ApplicantSummaryDocument {
  const scores = all.map(a => a.attributes.ai_score)
  const filtered = all
    .filter(a => params.minScore === null || a.attributes.ai_score >= params.minScore)
    .sort((a, b) => b.attributes.ai_score - a.attributes.ai_score || Number(a.id) - Number(b.id))
  const totalPages = Math.max(1, Math.ceil(filtered.length / params.size))
  const url = (page: number) => {
    const query = new URLSearchParams()
    if (params.minScore !== null) query.set('min_score', String(params.minScore))
    query.set('page[number]', String(page))
    query.set('page[size]', String(params.size))
    return `${basePath}?${query}`
  }

  return {
    data: filtered.slice((params.number - 1) * params.size, params.number * params.size),
    meta: {
      // Campaign-wide: ignores min_score (AI_LOG decision "min_score scope vs meta.summary").
      summary: {
        total_applicants: all.length,
        eligible_applicants: scores.filter(s => s >= ELIGIBLE_SCORE).length,
        average_ai_score: all.length ? Math.round((scores.reduce((sum, s) => sum + s, 0) / all.length) * 100) / 100 : 0,
        top_applicants: all
          .filter(a => a.attributes.ai_score >= TOP_SCORE)
          .sort((a, b) => b.attributes.ai_score - a.attributes.ai_score || Number(a.id) - Number(b.id))
          .slice(0, TOP_LIMIT)
          .map(a => ({ id: a.id, name: a.attributes.name, ai_score: a.attributes.ai_score })),
      },
      pagination: { page: params.number, size: params.size, total_pages: totalPages, total: filtered.length },
    },
    links: {
      first: url(1),
      last: url(totalPages),
      prev: params.number > 1 ? url(Math.min(params.number - 1, totalPages)) : null,
      next: params.number < totalPages ? url(params.number + 1) : null,
    },
  }
}
```

`frontend/server/utils/json-api.ts`

```ts
import type { H3Event } from 'h3'
import type { JsonApiErrorDocument } from '~/types/applicant'

export const JSON_API = 'application/vnd.api+json'

export function jsonApiError(event: H3Event, status: number, title: string, detail: string): JsonApiErrorDocument {
  setResponseStatus(event, status)
  setResponseHeader(event, 'content-type', JSON_API)
  return { errors: [{ status: String(status), title, detail }] }
}

/** Integer query param in [min, max]; `fallback` when absent, `undefined` when invalid (→ 422). */
export function intParam(value: unknown, min: number, max: number, fallback: number | null): number | null | undefined {
  if (value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined
}
```

`frontend/server/api/v1/campaigns/[campaignId]/applicant-summary.get.ts`

```ts
// Mock of GET /api/v1/campaigns/{campaignId}/applicant-summary (FRD-00: frontend data source = fixture/mocked handler).
import { applicants, buildApplicantSummary, MOCK_CAMPAIGN_ID } from '~/server/mock/applicant-summary'

export default defineEventHandler((event) => {
  if (getRouterParam(event, 'campaignId') !== MOCK_CAMPAIGN_ID) {
    return jsonApiError(event, 404, 'Not Found', 'Campaign not found.')
  }

  const query = getQuery(event)
  const minScore = intParam(query.min_score, 0, 100, null)
  const size = intParam(query['page[size]'], 1, 100, 10)
  const number = intParam(query['page[number]'], 1, 1_000_000, 1)
  if (minScore === undefined) return jsonApiError(event, 422, 'Invalid parameter', 'min_score must be an integer between 0 and 100.')
  if (size === undefined || size === null) return jsonApiError(event, 422, 'Invalid parameter', 'page[size] must be an integer between 1 and 100.')
  if (number === undefined || number === null) return jsonApiError(event, 422, 'Invalid parameter', 'page[number] must be a positive integer.')

  setResponseHeader(event, 'content-type', JSON_API)
  return buildApplicantSummary(applicants, { minScore, size, number }, event.path.split('?')[0])
})
```

`frontend/server/api/v1/applicants/[id]/status.patch.ts`

```ts
// Mock-only mutation for FR-F5: no backend route exists for it. Response mirrors the resource shape.
import type { ApplicantDocument, ApplicantStatus } from '~/types/applicant'
import { applicants } from '~/server/mock/applicant-summary'

const STATUSES: ApplicantStatus[] = ['pending', 'shortlisted', 'rejected']

export default defineEventHandler(async (event) => {
  const applicant = applicants.find(a => a.id === getRouterParam(event, 'id'))
  if (!applicant) return jsonApiError(event, 404, 'Not Found', 'Applicant not found.')

  const body = await readBody<{ status?: unknown }>(event)
  const status = STATUSES.find(s => s === body?.status)
  if (!status) return jsonApiError(event, 422, 'Invalid parameter', 'status must be one of: pending, shortlisted, rejected.')

  applicant.attributes.status = status
  setResponseHeader(event, 'content-type', JSON_API)
  const document: ApplicantDocument = { data: applicant }
  return document
})
```

## 2026-10-14 20:43 — P2 frontend — ApplicantReviewCard.vue + app wiring + Tailwind v4 (FR-F1/F3–F7)

**Prompt (verbatim):**
```text
3. `components/ApplicantReviewCard.vue`, `<script setup lang="ts">`. It needs:
   - a badge that uses color plus a text label (FR-F3);
   - a formatted date and 2–4 bullets (FR-F4);
   - optimistic Shortlist/Reject with disabled buttons and a rollback message (FR-F5);
   - a skeleton and an empty state with a clear-filter action (FR-F6);
   - a filter debounced at about 300 ms (FR-F7).
   Wire it into app.vue so it renders.
```

**Raw output (before refactor):**

`frontend/components/ApplicantReviewCard.vue`

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useApplicantSummary } from '~/composables/useApplicantSummary'
import type { ApplicantResource, ApplicantStatus } from '~/types/applicant'

const props = defineProps<{ campaignId: number }>()

const minScore = ref(0)
const { data, pending, error, refresh } = useApplicantSummary(props.campaignId, minScore)

// FR-F3: thresholds match FRD-00 (≥ 70 eligible, ≥ 90 top-tier); the label carries the meaning, color only reinforces it.
function tier(score: number): { label: string; classes: string } {
  if (score >= 90) return { label: 'Top-tier', classes: 'bg-green-100 text-green-800 ring-green-600/30' }
  if (score >= 70) return { label: 'Eligible', classes: 'bg-amber-100 text-amber-800 ring-amber-600/30' }
  return { label: 'Below threshold', classes: 'bg-gray-100 text-gray-700 ring-gray-500/30' }
}

const STATUS_LABELS: Record<ApplicantStatus, string> = {
  pending: 'Pending review',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
}

// UTC so server and client render the same string.
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

// FR-F5: optimistic update per applicant, following the optimistic-ui-vue skill.
const busy = ref<Record<string, boolean>>({})
const actionErrors = ref<Record<string, string>>({})

async function setStatus(applicant: ApplicantResource, next: ApplicantStatus): Promise<void> {
  const previous = applicant.attributes.status
  applicant.attributes.status = next
  busy.value[applicant.id] = true
  delete actionErrors.value[applicant.id]
  try {
    await $fetch(`/api/v1/applicants/${applicant.id}/status`, { method: 'PATCH', body: { status: next } })
  } catch {
    applicant.attributes.status = previous
    actionErrors.value[applicant.id] = `Could not update ${applicant.attributes.name}'s status. Please try again.`
  } finally {
    delete busy.value[applicant.id]
  }
}
</script>

<template>
  <section aria-labelledby="applicant-review-title" class="mx-auto max-w-3xl space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <header class="space-y-4">
      <h2 id="applicant-review-title" class="text-xl font-semibold text-gray-900">Applicant review</h2>
      <dl v-if="data" class="grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt class="text-gray-500">Total applicants</dt>
          <dd class="text-lg font-semibold">{{ data.meta.summary.total_applicants }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">Eligible (≥ 70)</dt>
          <dd class="text-lg font-semibold">{{ data.meta.summary.eligible_applicants }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">Average AI score</dt>
          <dd class="text-lg font-semibold">{{ data.meta.summary.average_ai_score.toFixed(2) }}</dd>
        </div>
      </dl>
    </header>

    <div class="space-y-1">
      <label for="min-score" class="block text-sm font-medium text-gray-700">Minimum AI score: {{ minScore }}</label>
      <input id="min-score" v-model.number="minScore" type="range" min="0" max="100" step="5" class="w-full accent-gray-900">
      <p v-if="data && !pending && !error" class="text-sm text-gray-500" aria-live="polite" data-test="match-count">
        {{ data.meta.pagination.total }} matching applicant{{ data.meta.pagination.total === 1 ? '' : 's' }}
      </p>
    </div>

    <div v-if="error" role="alert" class="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <span>{{ error }}</span>
      <button type="button" class="font-medium underline" @click="refresh">Retry</button>
    </div>

    <ul v-else-if="pending" aria-busy="true" class="space-y-4" data-test="skeleton">
      <span class="sr-only">Loading applicants…</span>
      <li v-for="n in 3" :key="n" class="animate-pulse space-y-3 rounded-lg border border-gray-100 p-4" aria-hidden="true">
        <div class="h-4 w-1/3 rounded bg-gray-200" />
        <div class="h-3 w-1/4 rounded bg-gray-200" />
        <div class="h-3 w-2/3 rounded bg-gray-200" />
      </li>
    </ul>

    <div v-else-if="data && data.data.length === 0" class="rounded-lg border border-dashed border-gray-300 p-8 text-center" data-test="empty">
      <p class="font-medium text-gray-900">No applicants match this minimum score.</p>
      <p class="mt-1 text-sm text-gray-500">Lower the threshold or clear the filter to see everyone.</p>
      <button type="button" class="mt-4 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white" @click="minScore = 0">
        Clear filter
      </button>
    </div>

    <ul v-else-if="data" class="space-y-4">
      <li v-for="applicant in data.data" :key="applicant.id">
        <article :aria-busy="busy[applicant.id] === true" class="space-y-3 rounded-lg border border-gray-200 p-4" data-test="applicant">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="font-semibold text-gray-900">{{ applicant.attributes.name }}</h3>
              <p class="text-sm text-gray-500">
                Applied <time :datetime="applicant.attributes.applied_at">{{ dateFormat.format(new Date(applicant.attributes.applied_at)) }}</time>
              </p>
            </div>
            <span
              :class="tier(applicant.attributes.ai_score).classes"
              class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
              data-test="badge"
            >
              {{ tier(applicant.attributes.ai_score).label }} · {{ applicant.attributes.ai_score }}
            </span>
          </div>

          <ul class="list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li v-for="highlight in applicant.attributes.highlights.slice(0, 4)" :key="highlight">{{ highlight }}</li>
          </ul>

          <div class="flex items-center justify-between gap-4">
            <p class="text-sm" aria-live="polite" data-test="status">
              Status: <strong>{{ STATUS_LABELS[applicant.attributes.status] }}</strong>
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                :disabled="busy[applicant.id] || applicant.attributes.status === 'shortlisted'"
                @click="setStatus(applicant, 'shortlisted')"
              >
                Shortlist
              </button>
              <button
                type="button"
                class="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
                :disabled="busy[applicant.id] || applicant.attributes.status === 'rejected'"
                @click="setStatus(applicant, 'rejected')"
              >
                Reject
              </button>
            </div>
          </div>
          <p v-if="actionErrors[applicant.id]" role="alert" class="text-sm text-red-700">{{ actionErrors[applicant.id] }}</p>
        </article>
      </li>
    </ul>
  </section>
</template>
```

`frontend/app.vue`

```vue
<template>
  <main class="min-h-screen bg-gray-50 px-4 py-10">
    <NuxtRouteAnnouncer />
    <ApplicantReviewCard :campaign-id="1" />
  </main>
</template>
```

`frontend/nuxt.config.ts`

```ts
// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
})
```

`frontend/assets/css/main.css`

```css
@import "tailwindcss";
```

## 2026-10-14 20:45 — P2 frontend — Vitest setup + component tests (FR-F9)

**Prompt (verbatim):**
```text
4. Vitest tests (FR-F9): data renders; the filter or a button changes the DOM; the rollback path on a failed request.
```

**Raw output (before refactor):**

`frontend/vitest.config.ts`

```ts
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '~': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { environment: 'happy-dom' },
})
```

`frontend/tests/ApplicantReviewCard.test.ts`

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApplicantReviewCard from '~/components/ApplicantReviewCard.vue'
import { FILTER_DEBOUNCE_MS } from '~/composables/useApplicantSummary'
import { applicants, buildApplicantSummary } from '~/server/mock/applicant-summary'

interface FetchOptions {
  method?: string
  query?: Record<string, number>
  body?: unknown
}

// Stands in for Nuxt's global $fetch: GETs are answered by the same builder the Nitro mock route uses.
const fetchMock = vi.fn((url: string, options?: FetchOptions): Promise<unknown> =>
  Promise.resolve(
    buildApplicantSummary(
      structuredClone(applicants),
      { minScore: options?.query?.min_score ?? null, size: options?.query?.['page[size]'] ?? 10, number: 1 },
      url,
    ),
  ),
)

const mountCard = () => mount(ApplicantReviewCard, { props: { campaignId: 1 } })
const names = (wrapper: ReturnType<typeof mountCard>) => wrapper.findAll('[data-test="applicant"] h3').map(h => h.text())

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('$fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ApplicantReviewCard', () => {
  it('shows a skeleton, then renders applicants with badge, date, bullets and summary', async () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-test="skeleton"]').exists()).toBe(true)

    await flushPromises()

    expect(wrapper.find('[data-test="skeleton"]').exists()).toBe(false)
    expect(names(wrapper)).toHaveLength(10)
    expect(names(wrapper)[0]).toBe('Jane Doe')
    expect(wrapper.text()).toContain('Total applicants 10')
    expect(wrapper.find('[data-test="match-count"]').text()).toBe('10 matching applicants')

    const first = wrapper.find('[data-test="applicant"]')
    expect(first.find('[data-test="badge"]').text()).toBe('Top-tier · 96')
    expect(first.find('time').text()).toBe('Oct 1, 2026')
    expect(first.findAll('ul li')).toHaveLength(4) // fixture has 5 highlights, FR-F4 caps at 4

    const badges = wrapper.findAll('[data-test="badge"]').map(b => b.text())
    expect(badges).toContain('Eligible · 70')
    expect(badges).toContain('Below threshold · 69')
  })

  it('debounces the min-score filter, refetches, and offers a clear-filter action when empty', async () => {
    vi.useFakeTimers()
    const wrapper = mountCard()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await wrapper.find('#min-score').setValue('90')
    await wrapper.find('#min-score').setValue('95')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.lastCall?.[1]?.query?.min_score).toBe(95)
    await flushPromises()

    expect(names(wrapper)).toEqual(['Jane Doe'])
    expect(wrapper.find('[data-test="match-count"]').text()).toBe('1 matching applicant')
    expect(wrapper.text()).toContain('Total applicants 10') // summary stays campaign-wide

    await wrapper.find('#min-score').setValue('100')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
    await flushPromises()
    expect(wrapper.find('[data-test="empty"]').exists()).toBe(true)

    await wrapper.find('[data-test="empty"] button').trigger('click')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
    await flushPromises()
    expect(names(wrapper)).toHaveLength(10)
  })

  it('shortlists optimistically and disables both buttons during the transition', async () => {
    const wrapper = mountCard()
    await flushPromises()
    let resolvePatch: (value: unknown) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolvePatch = resolve }))

    const card = wrapper.find('[data-test="applicant"]')
    await card.findAll('button')[0].trigger('click')

    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/applicants/1/status', { method: 'PATCH', body: { status: 'shortlisted' } })
    expect(card.find('[data-test="status"]').text()).toBe('Status: Shortlisted')
    expect(card.attributes('aria-busy')).toBe('true')
    expect(card.findAll('button').map(b => b.element.disabled)).toEqual([true, true])

    resolvePatch({})
    await flushPromises()
    expect(card.find('[data-test="status"]').text()).toBe('Status: Shortlisted')
    expect(card.findAll('button').map(b => b.element.disabled)).toEqual([true, false]) // already shortlisted; can still reject
    expect(card.find('[role="alert"]').exists()).toBe(false)
  })

  it('rolls back and shows a message when the status request fails', async () => {
    const wrapper = mountCard()
    await flushPromises()
    fetchMock.mockRejectedValueOnce(new Error('503'))

    const card = wrapper.find('[data-test="applicant"]')
    await card.findAll('button')[1].trigger('click')
    expect(card.find('[data-test="status"]').text()).toBe('Status: Rejected')

    await flushPromises()
    expect(card.find('[data-test="status"]').text()).toBe('Status: Pending review')
    expect(card.find('[role="alert"]').text()).toBe('Could not update Jane Doe\'s status. Please try again.')
    expect(card.findAll('button').map(b => b.element.disabled)).toEqual([false, false])
  })

  it('shows the API error detail when loading fails', async () => {
    fetchMock.mockRejectedValueOnce({
      data: { errors: [{ status: '404', title: 'Not Found', detail: 'Campaign not found.' }] },
    })
    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Campaign not found.')
    await wrapper.find('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(names(wrapper)).toHaveLength(10)
  })
})
```

**First run (raw):** `npx vitest run` → 3 failed | 2 passed (5).
- `Total applicants 10` not found: `wrapper.text()` concatenates `<dt>`/`<dd>` without a space (`Total applicants10`) — brittle assertion.
- Rollback test expected the optimistic `Rejected` after `await trigger('click')`, but `mockRejectedValueOnce` settles inside the same microtask flush, so the rollback had already happened — the test couldn't observe the optimistic state.

## 2026-10-14 20:46 — P2 frontend — refactor notes (raw → final)

**Refactor notes:**
- `ApplicantReviewCard.vue` skeleton: the raw draft put a `<span class="sr-only">` as a direct child of `<ul>` (invalid HTML; screen readers may skip it). Fixed: wrapper is a `<div role="status" aria-busy="true">` with `<div>` placeholders.
- `ApplicantReviewCard.vue` empty state: the raw draft showed "No applicants match this minimum score" + "Clear filter" even for a campaign with zero applicants (backend campaign 2), where clearing the filter is a no-op. Added a separate branch on `meta.summary.total_applicants === 0` with its own copy.
- `applicant-summary.get.ts`: `event.path.split('?')[0]` is `string | undefined` under the Nitro tsconfig (`noUncheckedIndexedAccess`). Replaced with `getRequestURL(event).pathname`.
- Tests: replaced `wrapper.text()` metric assertions with `<dd>` values; made the failing PATCH a deferred rejection so the test sees the optimistic `Rejected` + both buttons disabled before the rollback; `findAll('button')[i]` (possibly undefined under strict TS) → `get('button:nth-of-type(i)')`.
- Mutation check: deleting the `applicant.attributes.status = previous` rollback line makes the rollback test fail (1 failed | 4 passed). Restored.
- Known mock deviation: the mock builds `links` from the request path (relative URL). The backend builds absolute URLs from `APP_URL`. The UI doesn't read `links`.

**Result:** `npx vitest run` → 5 passed (5). `npm run build` → Build complete. `vue-tsc --noEmit` (app tsconfig, run once via npx, not added as a dependency) → 0 errors.

## Review findings — P2 frontend — 2026-10-14

**Reviewer:** code-reviewer (subagent). **Scope:** frontend/ files listed in the P2 brief, checked against FR-F1–F9, the optimistic-ui-vue and jsonapi-laravel skills, the P1/P2 `## Decision` entries, and backend ApplicantResource/ApplicantSummaryController/ApplicantSummaryService.
**Runs (by reviewer):** `npx vitest run` → 5 passed (5). `npm run build` → Build complete. `npx vue-tsc --noEmit` → 0 errors.

### Findings

1. **major (needs a human decision)** · `composables/useApplicantSummary.ts:30`, `nuxt.config.ts:4-11` · **(c) No path to the real backend.** FR-F8 says "API mocked via fixture/handler *if the backend isn't running*", which implies the real API is used when it is running. FRD-00, however, sets "Frontend data source = fixture/mocked handler". The app calls only the same-origin Nitro mock and never sends `X-Partner-Token`, so pointing it at Laravel would get a 401 on every call. Choosing a switch mechanism (runtimeConfig base URL + token header, or a Nitro proxy that injects the token, or mock-only) is a data-fetching decision. The orchestrator must ask the human. Fix: depends on the decision. Reviewer leans toward keeping the mock only and recording the FRD-00 reading in a Decision entry plus the README.
2. **minor** · `components/ApplicantReviewCard.vue:31-43` with `composables/useApplicantSummary.ts:33` · **Status change can race a refetch.** If a filter refetch resolves while a PATCH is still in flight, `data.value` is replaced. The new object shows the server's old status while the buttons stay disabled, because `busy` is keyed by id. When the PATCH then succeeds, `next` was written only to the orphaned old object, so the UI shows "Pending review" with no error. Rollback is safe because it writes to the orphan and the server state is correct. Fix: on settle, write to the current row (`data.value?.data.find(a => a.id === id)`), or keep a `Record<id, ApplicantStatus>` overlay that the template renders until the PATCH settles. Add one test.
3. **minor** · `composables/useApplicantSummary.ts:33-38`, `tests/ApplicantReviewCard.test.ts:59-87` · **The stale-response guard is untested.** No test resolves two overlapping fetches out of order, so deleting the three `request === latest` checks would still leave 5/5 green. Fix: in one test, hold the first GET in a deferred promise, change the filter, resolve the second GET and then the first, and assert the second result is the one rendered.
4. **minor** · `composables/useApplicantSummary.ts:5-6`, `components/ApplicantReviewCard.vue:70-72` · **(a) Fixed page[size]=100 truncates silently.** The match count shows `pagination.total` (for example 250) while at most 100 cards render, with no indication. No FR or PRD requires a pager, so this does not contradict the spec and needs no decision. Fix: when `total > data.length`, render "Showing {data.length} of {total}".
5. **minor** · `server/api/v1/campaigns/[campaignId]/applicant-summary.get.ts:5`, `server/utils/json-api.ts:13-16` · **The mock drifts from the FR-B7 contract.** A malformed campaignId (`abc`, `0`) returns 404 where the backend returns 422. There is no `X-Partner-Token` check, so 401 is never exercised. `intParam` accepts `1e1`, `0x10`, ` 5` and repeated params (`Number(['5'])`), all of which the Laravel `integer` rule rejects. Fix: test `/^[1-9]\d*$/` on campaignId and return 422, use `/^\d+$/` in `intParam`, and reject arrays.
6. **minor** · `tests/ApplicantReviewCard.test.ts:50-56` · **The FR-F3 color mapping is unasserted.** The tests check the labels only. Swapping the green and amber classes would pass. Fix: assert that each badge's classes contain `bg-green-100`, `bg-amber-100` and `bg-gray-100` respectively.
7. **minor** · `components/ApplicantReviewCard.vue:89-91`, `server/mock/applicant-summary.ts:5` · **The zero-applicants branch is untested and unreachable.** The mock knows only campaign 1, and every other id returns 404. Fix: add a test where `fetchMock` returns `buildApplicantSummary([], …)` and assert the "No one has applied" copy and that there is no Clear-filter button.
8. **minor (a11y)** · `components/ApplicantReviewCard.vue:70` · **The `aria-live` match count is mounted with `v-if` only after loading.** A live region inserted together with its content is often not announced. Fix: keep the `<p aria-live="polite">` always mounted and toggle only its text.
9. **nit (a11y)** · `components/ApplicantReviewCard.vue:80` · `role="status"` plus `aria-busy="true"` on the skeleton tells assistive tech to defer announcing that region, so "Loading applicants…" may never be read. Fix: drop `aria-busy` there.
10. **nit (a11y)** · `components/ApplicantReviewCard.vue:116` · The badge reads "Top-tier · 96", a bare number with no context. Fix: add `<span class="sr-only">AI score</span>` before the score.
11. **nit** · `components/ApplicantReviewCard.vue:24-25` · **(d) UTC dates:** the comment "so server and client render the same string" does not apply, because data is fetched `onMounted`, which is client-only, so SSR never renders a date. UTC can show a different calendar day from the reviewer's local day near midnight. This does not contradict FR-F4 and needs no decision. Fix: drop `timeZone` and use local time, or keep UTC and correct the comment.
12. **nit** · `server/api/v1/applicants/[id]/status.patch.ts:11` · A malformed JSON body makes `readBody` throw, and h3 answers with its default error instead of a JSON:API `errors[]`. Fix: wrap it in try/catch and return `jsonApiError(event, 400, …)`.
13. **nit** · `components/ApplicantReviewCard.vue:121` · `:key="highlight"` causes duplicate-key warnings if two highlights are identical. Fix: key by index.
14. **nit** · `components/ApplicantReviewCard.vue:29` · `actionErrors` outlives a refetch or Retry. A stale "Could not update…" stays under a card until the next click. Fix: clear it in `refresh()`, or leave it as is.
15. **nit** · `components/ApplicantReviewCard.vue:9` · `props.campaignId` is captured once, so a prop change never refetches. There is one caller with a constant id (YAGNI), so a note is enough.

### Explicitly clean (absence of findings)

- **`any` / unsafe casts:** none. The grep found 0 hits and vue-tsc reported 0 errors. Unknown input is narrowed with type guards (`isErrorDocument`, `STATUSES.find`).
- **Types vs backend:** they match ApplicantResource and the controller: `id` is a string, `status` is the 3-value enum, `applied_at` is a Zulu ISO string, `highlights` is `string[]` (non-null column), `top_applicants` is `{id: string, name, ai_score}`, and the pagination keys match. The only difference is that the mock's `links` are relative, which is already documented.
- **Optimistic update (FR-F5):** it snapshots, applies, disables both buttons, sets `aria-busy`, and rolls back with a visible message. The rollback is tested and was mutation-checked by the implementer.
- **Badge (FR-F3):** text label plus color, with the thresholds from FRD-00.
- **Debounce / timers:** the timer is cleared on every change and on unmount. No leak.
- **Security:** no `v-html`, so everything is escaped by Vue. The PATCH validates status against an allow-list. It has no auth, but it is mock-only.
- **Decisions honoured:** Tailwind v4 via `@tailwindcss/vite` (no config file). Plain Vitest with exactly the 4 agreed packages. The summary stays campaign-wide (mock line 54, test line 76). The order is `ai_score DESC, id ASC` (mock lines 41 and 61).
- **Over-engineering / dead code:** nothing material. `ApplicantDocument`, `links` and `top_applicants` exist for contract fidelity, not as dead code.
- **(b) mock-only PATCH `/api/v1/applicants/{id}/status`:** it is prescribed by the optimistic-ui-vue skill (PATCH `…/status`, body `{status}`). The backend scope (FR-B1–B9) has no write endpoint. This is not a new decision.

### Verdict

No blockers. The one major (finding 1, choice c) is a spec ambiguity between FR-F8 and FRD-00, not a code defect. The orchestrator should put it to the human as a Decision, and code goes back to the implementer only if the human chooses a real-backend option. Every FR-F1–F9 row is met by the code, and all FR-F9 scenarios are covered by tests that can fail. The minors are worth one short fix pass before the qa-gate, in this order: 2 (race), 3 (guard test), 4 (truncation notice), 8 (live region), 6 (color assertions). None of them breaks an FR. Of the self-reported choices, (a), (b) and (d) contradict no FR or PRD and need no human decision. (c) does.

## 2026-10-14 20:55 — P2 frontend — review fixes

**Prompt (verbatim):**
```text
P2 review loop-back in /Users/fernandoviviurka/Desktop/Projetos/b2b-fullstack-task-submission/frontend. Read `## Review findings — P2 frontend — 2026-10-14` in docs/AI_LOG.md and fix exactly these:
- #2: a status PATCH racing a refetch. On success and on rollback, write to the CURRENT row for that id, not the captured object. Add a test where a refetch lands while the PATCH is in flight and the final status is still correct.
- #3: add a test where two overlapping fetches resolve out of order and the older response is discarded. It must fail if the `request === latest` guard is removed; check that by deleting the guard temporarily.
- #4: show "Showing X of Y" when fewer rows are rendered than `meta.pagination.total`. Keep page[size]=100 and the existing `ponytail:` note.
- #5 (partial): the mock returns 422 (not 404) for a malformed campaign id, and `intParam` accepts only `^\d+$` strings.
- #6: assert the badge color classes for top-tier, eligible and below.
- #8: keep the `aria-live` match-count element always mounted and change only its text.
- #10: add "AI score" context for screen readers on the badge number.
- #13: key the highlights by index.
Skip the rest. Don't touch the backend URL or proxy question (finding #1); it's pending with the human.

Log per the ai-evidence-log skill: one AI_LOG entry `P2 frontend — review fixes` with this prompt and the diff. Zero `any`. Done means `npx vitest run` and `npm run build` both pass and `npx vue-tsc --noEmit` reports 0 errors. Don't run code-reviewer or qa-gate. Report the changes per finding and the final outputs.
```

**Raw output (diff as generated, before any refactor):**
```diff
--- a/frontend/components/ApplicantReviewCard.vue
+++ b/frontend/components/ApplicantReviewCard.vue
@@ -1,5 +1,5 @@
 <script setup lang="ts">
-import { ref } from 'vue'
+import { computed, ref } from 'vue'
 import { useApplicantSummary } from '~/composables/useApplicantSummary'
 import type { ApplicantResource, ApplicantStatus } from '~/types/applicant'
 
@@ -8,6 +8,15 @@
 const minScore = ref(0)
 const { data, pending, error, refresh } = useApplicantSummary(props.campaignId, minScore)
 
+// Text-only so the aria-live region stays mounted and announces changes (finding #8).
+const matchCount = computed(() => {
+  if (!data.value || pending.value || error.value) return ''
+  const { total } = data.value.meta.pagination
+  const shown = data.value.data.length
+  const count = `${total} matching applicant${total === 1 ? '' : 's'}`
+  return shown < total ? `${count} · Showing ${shown} of ${total}` : count
+})
+
 // FR-F3: thresholds match FRD-00 (≥ 70 eligible, ≥ 90 top-tier); the label carries the meaning, color only reinforces it.
 function tier(score: number): { label: string; classes: string } {
   if (score >= 90) return { label: 'Top-tier', classes: 'bg-green-100 text-green-800 ring-green-600/30' }
@@ -28,18 +37,25 @@
 const busy = ref<Record<string, boolean>>({})
 const actionErrors = ref<Record<string, string>>({})
 
+// A refetch may replace `data` while the PATCH is in flight, so settle onto the current row for that id.
+function setCurrentStatus(id: string, status: ApplicantStatus): void {
+  const current = data.value?.data.find(a => a.id === id)
+  if (current) current.attributes.status = status
+}
+
 async function setStatus(applicant: ApplicantResource, next: ApplicantStatus): Promise<void> {
-  const previous = applicant.attributes.status
+  const { id, attributes: { name, status: previous } } = applicant
   applicant.attributes.status = next
-  busy.value[applicant.id] = true
-  delete actionErrors.value[applicant.id]
+  busy.value[id] = true
+  delete actionErrors.value[id]
   try {
-    await $fetch(`/api/v1/applicants/${applicant.id}/status`, { method: 'PATCH', body: { status: next } })
+    await $fetch(`/api/v1/applicants/${id}/status`, { method: 'PATCH', body: { status: next } })
+    setCurrentStatus(id, next)
   } catch {
-    applicant.attributes.status = previous
-    actionErrors.value[applicant.id] = `Could not update ${applicant.attributes.name}'s status. Please try again.`
+    setCurrentStatus(id, previous)
+    actionErrors.value[id] = `Could not update ${name}'s status. Please try again.`
   } finally {
-    delete busy.value[applicant.id]
+    delete busy.value[id]
   }
 }
 </script>
@@ -67,9 +83,7 @@
     <div class="space-y-1">
       <label for="min-score" class="block text-sm font-medium text-gray-700">Minimum AI score: {{ minScore }}</label>
       <input id="min-score" v-model.number="minScore" type="range" min="0" max="100" step="5" class="w-full accent-gray-900">
-      <p v-if="data && !pending && !error" class="text-sm text-gray-500" aria-live="polite" data-test="match-count">
-        {{ data.meta.pagination.total }} matching applicant{{ data.meta.pagination.total === 1 ? '' : 's' }}
-      </p>
+      <p class="text-sm text-gray-500" aria-live="polite" data-test="match-count">{{ matchCount }}</p>
     </div>
 
     <div v-if="error" role="alert" class="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
@@ -113,12 +127,12 @@
               class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
               data-test="badge"
             >
-              {{ tier(applicant.attributes.ai_score).label }} · {{ applicant.attributes.ai_score }}
+              {{ tier(applicant.attributes.ai_score).label }} · <span class="sr-only">AI score</span> {{ applicant.attributes.ai_score }}
             </span>
           </div>
 
           <ul class="list-disc space-y-1 pl-5 text-sm text-gray-700">
-            <li v-for="highlight in applicant.attributes.highlights.slice(0, 4)" :key="highlight">{{ highlight }}</li>
+            <li v-for="(highlight, index) in applicant.attributes.highlights.slice(0, 4)" :key="index">{{ highlight }}</li>
           </ul>
 
           <div class="flex items-center justify-between gap-4">
--- a/frontend/server/utils/json-api.ts
+++ b/frontend/server/utils/json-api.ts
@@ -12,6 +12,8 @@
 /** Integer query param in [min, max]; `fallback` when absent, `undefined` when invalid (→ 422). */
 export function intParam(value: unknown, min: number, max: number, fallback: number | null): number | null | undefined {
   if (value === undefined || value === '') return fallback
+  // Digits only, like Laravel's `integer` rule: rejects '1e1', '0x10', ' 5' and repeated params (arrays).
+  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined
   const n = Number(value)
-  return Number.isInteger(n) && n >= min && n <= max ? n : undefined
+  return n >= min && n <= max ? n : undefined
 }
--- a/frontend/server/api/v1/campaigns/[campaignId]/applicant-summary.get.ts
+++ b/frontend/server/api/v1/campaigns/[campaignId]/applicant-summary.get.ts
@@ -2,7 +2,11 @@
 import { applicants, buildApplicantSummary, MOCK_CAMPAIGN_ID } from '~/server/mock/applicant-summary'
 
 export default defineEventHandler((event) => {
-  if (getRouterParam(event, 'campaignId') !== MOCK_CAMPAIGN_ID) {
+  const campaignId = getRouterParam(event, 'campaignId') ?? ''
+  if (!/^[1-9]\d*$/.test(campaignId)) {
+    return jsonApiError(event, 422, 'Invalid parameter', 'campaignId must be a positive integer.')
+  }
+  if (campaignId !== MOCK_CAMPAIGN_ID) {
     return jsonApiError(event, 404, 'Not Found', 'Campaign not found.')
   }
 
--- a/frontend/tests/ApplicantReviewCard.test.ts
+++ b/frontend/tests/ApplicantReviewCard.test.ts
@@ -3,6 +3,7 @@
 import ApplicantReviewCard from '~/components/ApplicantReviewCard.vue'
 import { FILTER_DEBOUNCE_MS } from '~/composables/useApplicantSummary'
 import { applicants, buildApplicantSummary } from '~/server/mock/applicant-summary'
+import { intParam } from '~/server/utils/json-api'
 
 interface FetchOptions {
   method?: string
@@ -21,6 +22,9 @@
   ),
 )
 
+const summary = (minScore: number | null, size = 100) =>
+  buildApplicantSummary(structuredClone(applicants), { minScore, size, number: 1 }, '/api/v1/campaigns/1/applicant-summary')
+
 const mountCard = () => mount(ApplicantReviewCard, { props: { campaignId: 1 } })
 const names = (wrapper: ReturnType<typeof mountCard>) => wrapper.findAll('[data-test="applicant"] h3').map(h => h.text())
 
@@ -47,15 +51,81 @@
     expect(wrapper.find('[data-test="match-count"]').text()).toBe('10 matching applicants')
 
     const first = wrapper.find('[data-test="applicant"]')
-    expect(first.find('[data-test="badge"]').text()).toBe('Top-tier · 96')
+    expect(first.find('[data-test="badge"]').text()).toBe('Top-tier · AI score 96')
     expect(first.find('time').text()).toBe('Oct 1, 2026')
     expect(first.findAll('ul li')).toHaveLength(4) // fixture has 5 highlights, FR-F4 caps at 4
 
-    const badges = wrapper.findAll('[data-test="badge"]').map(b => b.text())
-    expect(badges).toContain('Eligible · 70')
-    expect(badges).toContain('Below threshold · 69')
+    // FR-F3: label and color both; Jane 96, Sofia 70, Ethan 69.
+    const badges = wrapper.findAll('[data-test="badge"]')
+    const badge = (score: string) => badges.find(b => b.text().endsWith(` ${score}`))
+    expect(badge('96')?.text()).toBe('Top-tier · AI score 96')
+    expect(badge('96')?.classes()).toContain('bg-green-100')
+    expect(badge('70')?.text()).toBe('Eligible · AI score 70')
+    expect(badge('70')?.classes()).toContain('bg-amber-100')
+    expect(badge('69')?.text()).toBe('Below threshold · AI score 69')
+    expect(badge('69')?.classes()).toContain('bg-gray-100')
+    expect(badge('69')?.find('.sr-only').text()).toBe('AI score')
   })
 
+  it('keeps the live match count mounted and says when rows are truncated', async () => {
+    fetchMock.mockResolvedValueOnce(summary(null, 3))
+    const wrapper = mountCard()
+    const count = wrapper.find('[data-test="match-count"]')
+    expect(count.exists()).toBe(true)
+    expect(count.text()).toBe('')
+
+    await flushPromises()
+    expect(wrapper.find('[data-test="match-count"]').element).toBe(count.element) // same node, text swapped
+    expect(count.text()).toBe('10 matching applicants · Showing 3 of 10')
+    expect(names(wrapper)).toHaveLength(3)
+  })
+
+  it('discards an older filter response that resolves after a newer one', async () => {
+    vi.useFakeTimers()
+    const wrapper = mountCard()
+    await flushPromises()
+
+    let resolveOlder: (value: unknown) => void = () => {}
+    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveOlder = resolve }))
+    await wrapper.find('#min-score').setValue('90')
+    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS) // older request (min 90) in flight
+    await wrapper.find('#min-score').setValue('95')
+    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS) // newer request (min 95) resolves at once
+    await flushPromises()
+    expect(names(wrapper)).toEqual(['Jane Doe'])
+
+    resolveOlder(summary(90))
+    await flushPromises()
+    expect(names(wrapper)).toEqual(['Jane Doe'])
+    expect(wrapper.find('[data-test="match-count"]').text()).toBe('1 matching applicant')
+  })
+
+  it('keeps the new status when a refetch lands while the PATCH is in flight', async () => {
+    vi.useFakeTimers()
+    const wrapper = mountCard()
+    await flushPromises()
+    let resolvePatch: (value: unknown) => void = () => {}
+    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolvePatch = resolve }))
+
+    await wrapper.find('[data-test="applicant"] button:nth-of-type(1)').trigger('click')
+    await wrapper.find('#min-score').setValue('90')
+    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
+    await flushPromises() // refetch replaces data with the server's still-pending row
+
+    resolvePatch({})
+    await flushPromises()
+    const card = wrapper.find('[data-test="applicant"]')
+    expect(card.find('h3').text()).toBe('Jane Doe')
+    expect(card.find('[data-test="status"]').text()).toBe('Status: Shortlisted')
+    expect(card.findAll('button').map(b => b.element.disabled)).toEqual([true, false])
+  })
+
+  it('accepts only plain digit strings as integer query params (mirrors Laravel `integer`)', () => {
+    expect(intParam('5', 0, 100, null)).toBe(5)
+    expect(intParam(undefined, 0, 100, null)).toBeNull()
+    for (const bad of ['1e1', '0x10', ' 5', '-1', '101', ['5']]) expect(intParam(bad, 0, 100, null)).toBeUndefined()
+  })
+
   it('debounces the min-score filter, refetches, and offers a clear-filter action when empty', async () => {
     vi.useFakeTimers()
     const wrapper = mountCard()
```

**Refactor notes:** none, the diff above is the shipped version.
- #2: `setCurrentStatus(id, status)` looks the row up in the current `data` on success and rollback (fixes the orphaned-object race). Test "keeps the new status when a refetch lands while the PATCH is in flight" fails if success writes to the captured object (mutation-checked: 1 failed / 8 passed).
- #3: test "discards an older filter response…" fails with all three `request === latest` checks deleted (mutation-checked: 1 failed / 8 passed), then restored.
- #4/#8: `matchCount` computed; `<p aria-live="polite">` always mounted, empty while loading/error; appends "· Showing X of Y" when `data.length < total`. page[size]=100 and the `ponytail:` note are unchanged.
- #5 (partial): malformed campaignId → 422 (`/^[1-9]\d*$/`), unknown id → 404; `intParam` accepts only `^\d+$` strings, so arrays, `1e1`, `0x10` and ` 5` are rejected. Smoke-tested against the built server: abc/0 → 422, 2 → 404, `min_score=1e1` and repeated `min_score` → 422. The 401/token part was skipped as instructed.
- #6/#10: badge test asserts `bg-green-100` / `bg-amber-100` / `bg-gray-100` plus labels; `<span class="sr-only">AI score</span>` added before the number.
- #13: highlights are keyed by index.
- Results: `npx vitest run` → 9 passed (9); `npx vue-tsc --noEmit` → 0 errors; `npm run build` → Build complete; `any` grep → 0 hits.

## Decision — frontend data source: real backend vs mock — 2026-10-14

**Origin:** P2 code-reviewer finding #1 (major). FR-F8 ("mocked ... if the backend isn't running") vs FRD-00 (mock data source); the app never reached Laravel and never sent `X-Partner-Token`.
**Options presented:** A) browser calls Laravel directly through a runtime-config URL + token (needs CORS, token reaches the browser); B) Nuxt server-route proxy that adds the token on the server and falls back to the mock; C) mock-only, documented in the README.
**Choice:** human's own scoped version of B.
**Decision (human, verbatim):** "a Nuxt server route proxies GET applicant-summary to Laravel when BACKEND_URL is set (adding X-Partner-Token server-side, never exposing it to the browser), falling back to the mock otherwise."
**Rationale (human, verbatim):** "FR-F8's own wording ("if the backend isn't running") implies real connection is the intended behavior when it is running; the proxy keeps the token server-side (the exact reason to reject option A); the fallback preserves FRD-00's mock default, so tests and CI are untouched. Scope limit: the proxy covers only the summary GET — PATCH /applicants/{id}/status stays mock-only because no FR defines a write endpoint, and proxying it would make Shortlist/Reject roll back against the real backend. Document BACKEND_URL and this boundary in the README."
**Also decided:** no pagination controls is accepted as within FR-F6/F7 scope and recorded as a known limitation for the report (page[size]=100 cap). The mock-only status endpoint is covered by the scope limit above.

## 2026-10-14 22:36 — P2 frontend — backend proxy (Decision B scoped)

**Prompt (verbatim):**
```text
P2 follow-up in /Users/fernandoviviurka/Desktop/Projetos/b2b-fullstack-task-submission. First read `## Decision — frontend data source: real backend vs mock — 2026-10-14` in docs/AI_LOG.md, the human's decision. Implement exactly that scope:

1. In `frontend/server/api/v1/campaigns/[campaignId]/applicant-summary.get.ts`: when the server-only runtime config `backendUrl` is set (env `NUXT_BACKEND_URL`, documented as BACKEND_URL), proxy the GET to `${backendUrl}/api/v1/campaigns/{campaignId}/applicant-summary`.
   - Pass the original query string through unchanged; `page[size]` and so on must survive.
   - Add `X-Partner-Token` from the server-only runtime config `partnerToken` (env `NUXT_PARTNER_TOKEN`, with a non-empty demo default).
   - Pass the upstream status code, body and `application/vnd.api+json` back as-is, including 401/404/422 `errors[]`.
   - If the backend can't be reached, return a JSON:API `errors[]` 502. Don't silently fall back to the mock: the fallback applies only when `backendUrl` is unset.
   - When `backendUrl` is unset, the current mock behaviour stays exactly the same.
   - The token and the backend URL must never reach the browser, so they must not be under `runtimeConfig.public`.
2. `PATCH /api/v1/applicants/[id]/status` stays mock-only. Leave it untouched.
3. Add tests (Vitest, no new packages) for the proxy branch:
   - backend set: forwards the URL, the query and the token header, and passes the upstream status and body through;
   - backend unreachable: 502 `errors[]`;
   - backend unset: the mock is used.
   Keep the handler logic testable. A small pure function that the route calls is fine; avoid needing the Nuxt runtime in tests.
4. Create a root `README.md` (none exists yet). Keep it short and factual: the repo layout, backend setup (composer install, cp .env.example .env, key:generate, migrate --seed, serve, `php artisan test`) and frontend setup (npm install, npm run dev, `npx vitest run`). Add a "Frontend data source" section covering BACKEND_URL and PARTNER_TOKEN (the `NUXT_`-prefixed env names), the mock fallback, the PATCH status boundary (mock-only, because no FR defines a write endpoint), and the known limitation of no pagination controls with the page[size]=100 cap. Check each backend command actually works. You may run them against a scratch copy, but don't break backend/database/database.sqlite.
5. Run it once end to end: start Laravel (`php artisan serve` on a spare port) and the built Nuxt server with NUXT_BACKEND_URL pointing at it, and curl the Nuxt route. Show that the data comes from Laravel (absolute APP_URL links, 40 seeded applicants). Stop both servers afterwards.

Log per the ai-evidence-log skill: one AI_LOG entry `P2 frontend — backend proxy (Decision B scoped)` with this prompt and the raw code before any refactor. Zero `any`. Done means `npx vitest run`, `npx vue-tsc --noEmit` and `npm run build` all pass. Don't run code-reviewer or qa-gate. Report the files, the test, build and typecheck output, and the curl output.
```

**Raw output (before refactor) — `frontend/server/utils/backend-proxy.ts`:**
```ts
// Decision B (scoped): proxy GET applicant-summary to Laravel when NUXT_BACKEND_URL is set.
// Pure (no h3/Nuxt runtime) so it is unit-testable; the route wires it to the event.
import type { JsonApiErrorDocument } from '~/types/applicant'

export interface ProxyResult {
  status: number
  contentType: string
  body: string
}

export async function proxyApplicantSummary(
  backendUrl: string,
  partnerToken: string,
  campaignId: string,
  search: string,
  fetchFn: typeof fetch = fetch,
): Promise<ProxyResult> {
  const url = `${backendUrl.replace(/\/+$/, '')}/api/v1/campaigns/${encodeURIComponent(campaignId)}/applicant-summary${search}`
  try {
    const res = await fetchFn(url, {
      headers: { Accept: 'application/vnd.api+json', 'X-Partner-Token': partnerToken },
      signal: AbortSignal.timeout(10_000),
    })
    return {
      status: res.status,
      contentType: res.headers.get('content-type') ?? 'application/vnd.api+json',
      body: await res.text(),
    }
  } catch {
    const doc: JsonApiErrorDocument = {
      errors: [{ status: '502', title: 'Bad Gateway', detail: 'The applicant backend could not be reached.' }],
    }
    return { status: 502, contentType: 'application/vnd.api+json', body: JSON.stringify(doc) }
  }
}
```

**Raw output — `frontend/server/api/v1/campaigns/[campaignId]/applicant-summary.get.ts`:**
```ts
// GET /api/v1/campaigns/{campaignId}/applicant-summary.
// NUXT_BACKEND_URL set → proxy to Laravel (token added server-side); unset → FR-B7 mock (FRD-00 default).
import { applicants, buildApplicantSummary, MOCK_CAMPAIGN_ID } from '~/server/mock/applicant-summary'

export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'campaignId') ?? ''
  const { backendUrl, partnerToken } = useRuntimeConfig(event)
  if (backendUrl) {
    const res = await proxyApplicantSummary(backendUrl, partnerToken, campaignId, getRequestURL(event).search)
    setResponseStatus(event, res.status)
    setResponseHeader(event, 'content-type', res.contentType)
    return res.body
  }

  if (!/^[1-9]\d*$/.test(campaignId)) {
    return jsonApiError(event, 422, 'Invalid parameter', 'campaignId must be a positive integer.')
  }
  if (campaignId !== MOCK_CAMPAIGN_ID) {
    return jsonApiError(event, 404, 'Not Found', 'Campaign not found.')
  }

  const query = getQuery(event)
  const minScore = intParam(query.min_score, 0, 100, null)
  const size = intParam(query['page[size]'], 1, 100, 10)
  const number = intParam(query['page[number]'], 1, 1_000_000, 1)
  if (minScore === undefined) return jsonApiError(event, 422, 'Invalid parameter', 'min_score must be an integer between 0 and 100.')
  if (size === undefined || size === null) return jsonApiError(event, 422, 'Invalid parameter', 'page[size] must be an integer between 1 and 100.')
  if (number === undefined || number === null) return jsonApiError(event, 422, 'Invalid parameter', 'page[number] must be a positive integer.')

  setResponseHeader(event, 'content-type', JSON_API)
  return buildApplicantSummary(applicants, { minScore, size, number }, getRequestURL(event).pathname)
})
```

**Raw output — `frontend/nuxt.config.ts`:**
```ts
// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  // Server-only (never under `public`): env NUXT_BACKEND_URL / NUXT_PARTNER_TOKEN.
  runtimeConfig: {
    backendUrl: '',
    partnerToken: 'demo-partner-token',
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
```

**Refactor notes:**
- `proxyApplicantSummary` now takes the runtime-config object and returns `null` when `backendUrl` is empty. The raw version kept the "backend set?" branch inside the route, so the mock-fallback branch could only be tested with the Nuxt runtime. Now all three branches (proxy, unreachable → 502, unset → mock) are covered by `frontend/tests/backend-proxy.test.ts` with an injected `fetch`.
- Added an explicit `import { proxyApplicantSummary }` in the route. `vue-tsc --noEmit` failed with TS2552 because the Nitro auto-import types were not regenerated for the new util.
- Kept from the raw version: `encodeURIComponent(campaignId)` (no path injection into the upstream URL), the raw `search` string (bracketed `page[size]` survives byte for byte), a 10 s `AbortSignal.timeout` (a hung backend becomes a 502 instead of hanging), and a server-only `runtimeConfig` (not `public`).
- Known side effect: upstream `links` are Laravel `APP_URL` absolute URLs, passed through as-is per the brief, so the backend's public URL appears in the response body. The token never does.
- E2E verified: Laravel on :8765 plus the built Nuxt server proxying returned 40 seeded applicants with `APP_URL` links. Upstream 422 and 404 `errors[]` passed through. With Laravel stopped the route returned a JSON:API 502. With the env unset it served the mock (10 fixture rows).

## QA gate — P2 frontend — 2026-10-14

Gate: `qa-gate`. No code was modified.
**Runs:**
- `cd frontend && npx vitest run` → 2 files, **12 passed (12)**: `ApplicantReviewCard.test.ts` 9, `backend-proxy.test.ts` 3.
- `npx vue-tsc --noEmit` → exit 0, 0 errors.
- `npm run build` → "Build complete!"
- `cd backend && php artisan test` → **30 passed (229 assertions)**, so P1 is still green.
- `any` grep (`\bany\b|as unknown as|@ts-ignore|@ts-expect-error` over components, composables, types, server, tests and configs) → 0 hits.

**E2E:** Laravel `php artisan serve --port=8791` ran on a scratch SQLite DB (`migrate:fresh --seed`). Three built Nuxt servers ran against it: :3791 with `NUXT_BACKEND_URL` + `NUXT_PARTNER_TOKEN=qa-secret-xyz`, :3792 with no URL, and :3793 with the URL pointing at a dead port. All servers were stopped afterwards and the scratch DB was deleted. `backend/database/database.sqlite` is unchanged (verified with shasum).

### FR rows

| FR id | Verdict | Evidence | Note |
| --- | --- | --- | --- |
| FR-F1 | PASS | `frontend/components/ApplicantReviewCard.vue:1` (`<script setup lang="ts">`), Composition API `ref`/`computed` :2-9, Tailwind classes throughout. `assets/css/main.css:1` `@import "tailwindcss"` | |
| FR-F2 | PASS | `frontend/types/applicant.ts:3-71`. The proxied Laravel body (E2E :3791) matches the shape: `id` is a string, the status enum, `applied_at` is Zulu, and the meta/links keys match. `any` grep: 0 hits, vue-tsc: 0 errors | |
| FR-F3 | PASS | `ApplicantReviewCard.vue:21-25` (≥90 green "Top-tier", ≥70 amber "Eligible", else gray "Below threshold"), :130 label + sr-only "AI score". Test "shows a skeleton, then renders…" asserts the label and `bg-green-100`/`bg-amber-100`/`bg-gray-100` for 96/70/69 | Boundaries at 90/70/69 are tested |
| FR-F4 | PASS | `ApplicantReviewCard.vue:120` name, :125-131 badge, :122 `<time>` formatted date, :135 `highlights.slice(0, 4)`. The test asserts "Oct 1, 2026" and caps 5 highlights at 4 | 2–4: the fixture has at least 2 highlights; the cap is 4 |
| FR-F5 | PASS | `ApplicantReviewCard.vue:46-60` (immediate apply, `busy`, rollback + message), :146/:154 disabled. Tests: "shortlists optimistically and disables both buttons…", "rolls back and shows a message when the status request fails", "keeps the new status when a refetch lands while the PATCH is in flight" | See the PATCH-boundary FAIL below for proxy mode |
| FR-F6 | PASS | Skeleton `ApplicantReviewCard.vue:94-101` (`animate-pulse`). Empty states :103-113 with copy + "Clear filter" (`minScore = 0`). Tests: first test (skeleton) and "debounces … offers a clear-filter action when empty" | |
| FR-F7 | PASS | `composables/useApplicantSummary.ts:4` `FILTER_DEBOUNCE_MS = 300`, :42-45 debounced watch → refetch with `min_score`. The test asserts no call at 299 ms, a call at 300 ms, and `min_score` 95 | Slider `ApplicantReviewCard.vue:85` |
| FR-F8 | PASS | `useApplicantSummary.ts:18-50` returns `{ data, pending, error, refresh }`. Mock handler `server/api/v1/campaigns/[campaignId]/applicant-summary.get.ts:15-31` + fixture `server/mock/applicant-summary.ts`. E2E :3792 (no URL) → 200 mock JSON:API | |
| FR-F9 | PASS | Vitest 12/12. Rendering is covered by the first test; DOM changes on interaction are covered by the filter test and the Shortlist/Reject tests | |

### PRD-E2 acceptance criteria

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| Card: name, color-coded badge, date, bullets | PASS | FR-F3/F4 rows |
| Optimistic Shortlist/Reject + transition indicator + rollback | PASS | FR-F5 row; `aria-busy` + disabled buttons asserted in the tests |
| Skeleton while loading; empty state on no match | PASS | FR-F6 row |
| Slider re-filters reactively | PASS | FR-F7 row |
| 1+ automated test: render + interaction changes DOM | PASS | FR-F9 row |

### Human decisions

| Decision | Verdict | Evidence |
| --- | --- | --- |
| Tailwind v4 via `@tailwindcss/vite`, no `@nuxtjs/tailwindcss` | PASS | `frontend/package.json` deps `@tailwindcss/vite`/`tailwindcss` ^4.3.3. `nuxt.config.ts:2,14` `vite.plugins: [tailwindcss()]`. `@nuxtjs/tailwindcss` is absent |
| Plain Vitest, 4 packages, no `@nuxt/test-utils`/`unplugin-auto-import` | PASS | devDependencies are exactly `vitest`, `@vue/test-utils`, `@vitejs/plugin-vue`, `happy-dom`. `vitest.config.ts` uses `environment: 'happy-dom'`. Neither forbidden package is in package.json |
| min_score leaves the summary campaign-wide | PASS | `server/mock/applicant-summary.ts:54-64` uses `all`, not `filtered`. The test asserts `dd` stays `['10','7','76.50']` at min 95. E2E proxy min_score=90 → `total_applicants` 40, `pagination.total` 3 |
| Order `ai_score DESC, id ASC` | PASS | `server/mock/applicant-summary.ts:41,61`. E2E proxy order: 12(99), 8(94), 20(93) |
| Proxy: GET only when `NUXT_BACKEND_URL` set | PASS | `server/utils/backend-proxy.ts:18-29`, route `applicant-summary.get.ts:8-13`. E2E :3791 → 200 Laravel data, 422 and 404 `errors[]` passed through as-is |
| Token server-only | PASS | `nuxt.config.ts:7-10` (not under `public`). `grep -rl demo-partner-token .output/public` → no hit. `grep -rliE 'backendUrl\|partnerToken\|X-Partner-Token\|NUXT_BACKEND' .output/public` → no hit. SSR HTML from :3791 contains neither `qa-secret-xyz` nor `8791` nor `backendUrl` (0 matches). The token appears only in `.output/server/chunks/nitro/nitro.mjs` |
| Mock fallback when URL unset | PASS | `backend-proxy.ts:18` returns null. Test "returns null (route serves the mock)…". E2E :3792 → mock data |
| 502 when backend unreachable | PASS | `backend-proxy.ts:30-34`. Test "returns a JSON:API 502…". E2E :3793 → `502 application/vnd.api+json` Bad Gateway `errors[]` |
| PATCH stays mock-only | PASS (literal) | `server/api/v1/applicants/[id]/status.patch.ts` has no proxy call. The Laravel log shows 0 PATCH hits |
| README documents BACKEND_URL, PATCH boundary, page[size]=100 | **FAIL** | `README.md:42-55` documents all three, but the PATCH-boundary text is inaccurate. See the defect below |

### Review findings

| Finding | Verdict | Evidence |
| --- | --- | --- |
| #2 race PATCH vs refetch | PASS | `ApplicantReviewCard.vue:40-44,53,55` `setCurrentStatus` writes to the current row. Test "keeps the new status when a refetch lands while the PATCH is in flight" |
| #3 stale-response guard untested | PASS | Test "discards an older filter response that resolves after a newer one" |
| #4 page[size]=100 silent truncation | PASS | `ApplicantReviewCard.vue:12-18` "Showing N of M". Test "keeps the live match count mounted and says when rows are truncated" |
| #5 (partial) mock contract drift | PASS (partial, as scoped) | `applicant-summary.get.ts:15-17` → 422. `json-api.ts:16` digit-only and rejects arrays. E2E mock: `abc`, `0`, `1e1`, repeated `min_score`, `0x10`, `%205` → all 422. Test "accepts only plain digit strings…". The mock still doesn't check `X-Partner-Token` (200 without it), which is the accepted partial |
| #6 color mapping unasserted | PASS | Test lines 62/64/66 assert the `bg-*-100` classes |
| #8 aria-live mounted late | PASS | `ApplicantReviewCard.vue:86` is always mounted with text-only toggling. The test asserts it's the same element before and after load |
| #10 badge bare number | PASS | `ApplicantReviewCard.vue:130` sr-only "AI score". Asserted at test line 67 |
| #13 duplicate highlight keys | PASS | `ApplicantReviewCard.vue:135` `:key="index"` |

### Defect (FAIL)

**PATCH boundary is mis-documented and contradicts the decision's rationale in proxy mode.** E2E on :3791 (proxy on, 40 seeded backend applicants): `PATCH /api/v1/applicants/25/status` → **404 "Applicant not found."** (`status.patch.ts:8-9` looks the id up in the 10-row mock fixture), while `PATCH …/1/status` → 200 and mutates the mock's "Jane Doe", an unrelated record. So in proxy mode Shortlist/Reject fails with an error and rolls back for 30 of 40 real applicants (for example the top one, id 12), and silently "succeeds" for ids 1–10. The human's rationale for keeping PATCH mock-only was to avoid exactly this: "proxying it would make Shortlist/Reject roll back against the real backend". `README.md:50-52` says only that "status changes are therefore not persisted", which hides the rollback/404 behaviour.

**Required change (one of the two; the orchestrator should check with the human if it is unsure which matches the decision's intent):**
1. Make the mock PATCH accept any well-formed id when `backendUrl` is set: validate `status` and echo back a 200 without a fixture lookup. Add one test. Optimistic updates then stick in proxy mode and stay non-persisted, as the README already says. Or:
2. Keep the behaviour and correct `README.md:50-52` to state that, against the real backend, Shortlist/Reject returns 404 and rolls back for applicants not in the mock fixture (ids outside 1–10).

### Gate verdict

**FAIL.** 1 item. All nine FR-F rows and all five PRD-E2 criteria PASS. The suites are green: vitest 12/12, vue-tsc 0, build OK, backend 30/30. Seven of the eight review findings are fully fixed and #5 is fixed within its agreed partial scope. Every decision PASSES except the README/PATCH-boundary row, which FAILS on the E2E-proven defect above. After the fix, re-run the gate (vitest + the proxy-mode PATCH E2E).

## Decision — Shortlist/Reject in proxy mode — 2026-10-14

**Origin:** P2 qa-gate FAIL. With NUXT_BACKEND_URL set, the mock PATCH looks ids up in its 10-row fixture, so real backend ids outside 1–10 return 404 and roll back (including top-ranked id 12), and ids 1–10 change the wrong person.
**Options presented:** A) in proxy mode the mock PATCH accepts any well-formed id, keeps the status in memory and returns 200; B) README correction only; C) disable the buttons in proxy mode.
**Choice:** A (human).
**Rationale:** delivers the intent of the scoped proxy decision (no rollback against the real backend) with the smallest change; the README must state the status isn't saved to Laravel.

## 2026-10-14 22:58 — P2 frontend — qa-gate fix: proxy-mode PATCH

**Prompt (verbatim):**
```text
P2 qa-gate loop-back in /Users/fernandoviviurka/Desktop/Projetos/b2b-fullstack-task-submission. First read `## QA gate — P2 frontend — 2026-10-14` and `## Decision — Shortlist/Reject in proxy mode — 2026-10-14` in docs/AI_LOG.md.

Implement Decision A:
- In `frontend/server/api/v1/applicants/[id]/status.patch.ts`, when the server-only runtime config `backendUrl` is set, accept any well-formed id (`^[1-9]\d*$`, otherwise a 422 in `errors[]` form), validate `status` as today, and keep the new status in an in-memory map by id. Return 200 with the same response shape as now, and skip the fixture lookup.
- When `backendUrl` is unset, behaviour stays exactly as it is now.
- Keep the logic testable without the Nuxt runtime, like backend-proxy.ts, using a small pure function if needed.
- Add a test: proxy mode with id 25 gives 200 and the status is stored; a malformed id gives 422; and the existing mock-mode behaviour is unchanged.
- Correct `README.md` (around lines 50-52). In proxy mode, Shortlist/Reject work for any applicant, but the status lives only in the Nuxt server's memory: it is never saved to Laravel and is lost on restart. That's because no FR defines a backend write endpoint.

Log per the ai-evidence-log skill: one AI_LOG entry `P2 frontend — qa-gate fix: proxy-mode PATCH` with this prompt and the raw diff. Zero `any`. Done means `npx vitest run`, `npx vue-tsc --noEmit` and `npm run build` all pass. Then verify end to end:
- Laravel on a spare port against a seeded scratch DB (don't touch backend/database/database.sqlite), plus the built Nuxt server with NUXT_BACKEND_URL;
- `PATCH /api/v1/applicants/12/status` and `PATCH /api/v1/applicants/25/status` with `{"status":"shortlisted"}` both return 200;
- stop both servers.
Don't run code-reviewer or qa-gate. Report the changes and all outputs.
```

**Raw output (before refactor):**
```diff
--- a/frontend/server/api/v1/applicants/[id]/status.patch.ts
+++ b/frontend/server/api/v1/applicants/[id]/status.patch.ts
@@ -1,19 +1,10 @@
-// Mock-only mutation for FR-F5: no backend route exists for it. Response mirrors the resource shape.
-import type { ApplicantDocument, ApplicantStatus } from '~/types/applicant'
-import { applicants } from '~/server/mock/applicant-summary'
+// FR-F5 status mutation; no backend route exists for it. Logic lives in server/utils/status-update.ts.
+import { updateApplicantStatus } from '~/server/utils/status-update'
 
-const STATUSES: ApplicantStatus[] = ['pending', 'shortlisted', 'rejected']
-
 export default defineEventHandler(async (event) => {
-  const applicant = applicants.find(a => a.id === getRouterParam(event, 'id'))
-  if (!applicant) return jsonApiError(event, 404, 'Not Found', 'Applicant not found.')
-
   const body = await readBody<{ status?: unknown }>(event)
-  const status = STATUSES.find(s => s === body?.status)
-  if (!status) return jsonApiError(event, 422, 'Invalid parameter', 'status must be one of: pending, shortlisted, rejected.')
-
-  applicant.attributes.status = status
+  const res = updateApplicantStatus(useRuntimeConfig(event).backendUrl, getRouterParam(event, 'id'), body?.status)
+  setResponseStatus(event, res.status)
   setResponseHeader(event, 'content-type', JSON_API)
-  const document: ApplicantDocument = { data: applicant }
-  return document
+  return res.body
 })
--- /dev/null
+++ b/frontend/server/utils/status-update.ts
@@ -0,0 +1,46 @@
+// FR-F5 PATCH status. Pure (no h3/Nuxt runtime) so both modes are unit-testable; the route wires it to the event.
+// Decision A (proxy mode): no FR defines a backend write endpoint, so with backendUrl set the status is kept
+// only in this server's memory, by id, and never reaches Laravel.
+// ponytail: unbounded in-process map, lost on restart; replace with a real backend endpoint if an FR adds one.
+import type { ApplicantResource, ApplicantStatus, JsonApiErrorDocument } from '~/types/applicant'
+import { applicants } from '~/server/mock/applicant-summary'
+
+const STATUSES: ApplicantStatus[] = ['pending', 'shortlisted', 'rejected']
+
+export const proxyStatuses = new Map<string, ApplicantStatus>()
+
+/** Proxy mode only knows the id and status, so `attributes` carries just `status` (JSON:API partial resource). */
+export interface StatusDocument {
+  data: Pick<ApplicantResource, 'type' | 'id'> & { attributes: Partial<ApplicantResource['attributes']> & { status: ApplicantStatus } }
+}
+
+export interface StatusUpdateResult {
+  status: number
+  body: StatusDocument | JsonApiErrorDocument
+}
+
+const error = (status: number, title: string, detail: string): StatusUpdateResult =>
+  ({ status, body: { errors: [{ status: String(status), title, detail }] } })
+
+export function updateApplicantStatus(
+  backendUrl: string,
+  id: string | undefined,
+  rawStatus: unknown,
+  store: Map<string, ApplicantStatus> = proxyStatuses,
+): StatusUpdateResult {
+  const status = STATUSES.find(s => s === rawStatus)
+  const invalidStatus = () => error(422, 'Invalid parameter', 'status must be one of: pending, shortlisted, rejected.')
+
+  if (backendUrl) {
+    if (!id || !/^[1-9]\d*$/.test(id)) return error(422, 'Invalid parameter', 'id must be a positive integer.')
+    if (!status) return invalidStatus()
+    store.set(id, status)
+    return { status: 200, body: { data: { type: 'applicants', id, attributes: { status } } } }
+  }
+
+  const applicant = applicants.find(a => a.id === id)
+  if (!applicant) return error(404, 'Not Found', 'Applicant not found.')
+  if (!status) return invalidStatus()
+  applicant.attributes.status = status
+  return { status: 200, body: { data: applicant } }
+}
--- /dev/null
+++ b/frontend/tests/status-update.test.ts
@@ -0,0 +1,43 @@
+import { afterEach, describe, expect, it } from 'vitest'
+import type { ApplicantStatus } from '~/types/applicant'
+import { applicants } from '~/server/mock/applicant-summary'
+import { updateApplicantStatus } from '~/server/utils/status-update'
+
+const BACKEND = 'http://laravel.test'
+
+describe('updateApplicantStatus', () => {
+  afterEach(() => { applicants[0].attributes.status = 'pending' })
+
+  it('proxy mode: accepts any well-formed id, stores the status, skips the fixture', () => {
+    const store = new Map<string, ApplicantStatus>()
+
+    const res = updateApplicantStatus(BACKEND, '25', 'shortlisted', store)
+
+    expect(res).toEqual({ status: 200, body: { data: { type: 'applicants', id: '25', attributes: { status: 'shortlisted' } } } })
+    expect(store.get('25')).toBe('shortlisted')
+    updateApplicantStatus(BACKEND, '1', 'rejected', store)
+    expect(applicants[0].attributes.status).toBe('pending')
+  })
+
+  it('proxy mode: malformed id or status gives a JSON:API 422 and stores nothing', () => {
+    const store = new Map<string, ApplicantStatus>()
+
+    for (const id of ['abc', '0', '01', '1e1', undefined]) {
+      const res = updateApplicantStatus(BACKEND, id, 'shortlisted', store)
+      expect(res.status).toBe(422)
+      expect(res.body).toEqual({ errors: [{ status: '422', title: 'Invalid parameter', detail: 'id must be a positive integer.' }] })
+    }
+    expect(updateApplicantStatus(BACKEND, '25', 'hired', store).status).toBe(422)
+    expect(store.size).toBe(0)
+  })
+
+  it('mock mode (no backendUrl): unchanged — fixture lookup, 404 for unknown ids, 422 for bad status', () => {
+    expect(updateApplicantStatus('', '25', 'shortlisted').status).toBe(404)
+    expect(updateApplicantStatus('', '1', 'hired').status).toBe(422)
+
+    const res = updateApplicantStatus('', '1', 'shortlisted')
+
+    expect(res).toEqual({ status: 200, body: { data: applicants[0] } })
+    expect(applicants[0].attributes.status).toBe('shortlisted')
+  })
+})
```

**Refactor notes:** the raw version declared a local `StatusDocument` type in `status-update.ts` while
`ApplicantDocument` in `types/applicant.ts` became unused (dead contract type). Folded it into the shared
contract instead: `ApplicantDocument.data.attributes` is now `Partial<ApplicantAttributes> & Pick<ApplicantAttributes, 'status'>`
(proxy mode only knows id + status, a JSON:API partial resource; mock mode still returns the full resource).
README additionally states that the proxied GET passes Laravel's body through unchanged, so a refetch
shows Laravel's status again (the in-memory map is not overlaid on GET; not in Decision A's scope).

**Checks:** `npx vitest run` → 3 files, 15 passed. `npx vue-tsc --noEmit` → exit 0. `npm run build` → Build complete.
E2E (Laravel :8795 on scratch seeded SQLite, Nuxt :3795 with `NUXT_BACKEND_URL`): PATCH 12 → 200, PATCH 25 → 200,
PATCH abc → 422, PATCH 25 `hired` → 422; Laravel log 0 PATCH hits. Nuxt :3796 without URL: PATCH 25 → 404, PATCH 1 → 200
full resource (unchanged). Servers stopped, scratch DB deleted, `backend/database/database.sqlite` shasum unchanged.

## QA gate (re-run) — P2 frontend — 2026-10-14

Gate: `qa-gate`, re-run after the loop-back fix (Decision "Shortlist/Reject in proxy mode", option A). No code was modified.
**Runs:**
- `cd frontend && npx vitest run` → 3 files, **15 passed (15)**: `ApplicantReviewCard.test.ts` 9, `backend-proxy.test.ts` 3, `status-update.test.ts` 3.
- `npx vue-tsc --noEmit` → exit 0. `npm run build` → "Build complete!", exit 0.
- `cd backend && php artisan test` → **30 passed (229 assertions)**.
- Grep `\bany\b|as unknown as|@ts-ignore|@ts-expect-error` over components, composables, types, server, tests, app.vue and configs → 1 hit only: `tests/status-update.test.ts:11`, inside the English test name ("accepts any well-formed id"). That is not a type, so there are 0 typing hits.

**E2E:** the real DB shasum before the run was `964cb28e…`. Laravel `php artisan serve --port=8797` ran on a scratch SQLite DB (`migrate:fresh --seed`, overridden with `DB_DATABASE`). Two built Nuxt servers ran: :3797 with `NUXT_BACKEND_URL=http://127.0.0.1:8797` + `NUXT_PARTNER_TOKEN=qa-rerun-token`, and :3798 with no URL.
- Proxy GET → 40 applicants. The top-ranked rows were **34 (99)**, 29 (98), 2 (95). The seed is random, so the top id differs from the previous run's 12.
- Proxy PATCH `{"status":"shortlisted"|"rejected"}` → **34: 200**, **25: 200**, 12: 200, 2: 200 (an id inside the fixture range is no longer mapped to a fixture person). Each body is `{"data":{"type":"applicants","id":…,"attributes":{"status":…}}}`.
- Proxy PATCH malformed ids `abc`, `0`, `01`, `1e1` → **422** `errors[]` "id must be a positive integer.". PATCH 25 `hired` → 422 (status rule).
- Laravel log: 3 requests, all `/api/v1/campaigns/1/applicant-summary`. That is exactly the 3 proxy GETs. **0 requests to `/api/v1/applicants/*`**, even though Nuxt handled 8 PATCHes.
- Proxy GET after PATCH: ids 12 and 25 still show `pending` (Laravel's body). This matches the README's "a refetch shows Laravel's status again".
- Mock mode (:3798, URL unset), unchanged from the previous gate: GET → 10 fixture rows with relative links. PATCH 25 → 404, PATCH 1 → 200 full resource (Jane Doe), PATCH 1 `hired` → 422, PATCH abc → 404.
- All servers were stopped (no listeners on 8797/3797/3798) and the scratch DB was deleted. `backend/database/database.sqlite` shasum is unchanged (`964cb28e…`).

### FR rows

| FR id | Verdict | Evidence | Note |
| --- | --- | --- | --- |
| FR-F1 | PASS | `components/ApplicantReviewCard.vue:1` `<script setup lang="ts">`, `ref`/`computed` :2,8-18, Tailwind classes; `assets/css/main.css:1` | Unchanged |
| FR-F2 | PASS | `types/applicant.ts:3-74`, vue-tsc 0, 0 `any`. Widening checked: `ApplicantDocument` (:62-64) is only used in `server/utils/status-update.ts:5,14`. The card types its rows as `ApplicantResource` (`ApplicantReviewCard.vue:4,46`), whose `attributes: ApplicantAttributes` (:14-18) is still fully required. `ApplicantSummaryDocument.data` is still `ApplicantResource[]` (:50). The card's PATCH `$fetch` result is discarded (:52), so no partial type reaches the template | The widening doesn't weaken the card's typing |
| FR-F3 | PASS | `ApplicantReviewCard.vue:21-25,125-131`; test `ApplicantReviewCard.test.ts:41` (classes asserted :62-66) | Unchanged |
| FR-F4 | PASS | `ApplicantReviewCard.vue:120,122,125-131,135`; test :55 date, :56 cap at 4 | Unchanged |
| FR-F5 | PASS | `ApplicantReviewCard.vue:46-60,146,154`; tests :159 optimistic + disabled, :180 rollback + message, :103 refetch race. Proxy mode now: E2E PATCH 34/25 → 200, so the optimistic update sticks, with no rollback against real ids | The previous FAIL is resolved |
| FR-F6 | PASS | Skeleton `ApplicantReviewCard.vue:94-101`, empty + "Clear filter" :103-113; tests :41, :129 | Unchanged |
| FR-F7 | PASS | `composables/useApplicantSummary.ts:4,42-45`; test :129 (299 ms vs 300 ms, `min_score` 95 at :141) | Unchanged |
| FR-F8 | PASS | `useApplicantSummary.ts:18-50` `{data,pending,error,refresh}`; mock handler + fixture; E2E :3798 → mock | Unchanged |
| FR-F9 | PASS | Vitest 15/15. Render: test :41. DOM change on interaction: tests :129, :159, :180 | |

### PRD-E2 acceptance criteria

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| Card: name, color-coded badge, date, bullets | PASS | FR-F3/F4 |
| Optimistic Shortlist/Reject + transition indicator + rollback | PASS | FR-F5. Now also holds in proxy mode (E2E 200s) |
| Skeleton while loading; empty state | PASS | FR-F6 |
| Slider re-filters reactively | PASS | FR-F7 |
| 1+ automated test: render + interaction | PASS | FR-F9 |

### Previous FAIL — resolution

| Check | Verdict | Evidence |
| --- | --- | --- |
| Proxy-mode PATCH accepts any well-formed id → 200 | PASS | `server/utils/status-update.ts:29-34`; test `status-update.test.ts:11`; E2E 34/25/12/2 → 200 |
| Malformed id → 422 `errors[]` | PASS | `status-update.ts:30`; test :22; E2E abc/0/01/1e1 → 422 |
| No fixture lookup or mutation in proxy mode | PASS | `status-update.ts:29-34` returns before :36; test :11 asserts fixture id 1 stays `pending` |
| Laravel receives no PATCH | PASS | Laravel log: only the 3 summary GETs, 0 `/applicants/` hits |
| Mock mode unchanged when the URL is unset | PASS | `status-update.ts:36-40`, route `status.patch.ts:6` passes `useRuntimeConfig(event).backendUrl`; test :34; E2E :3798 → 404/200/422/404 |
| README: in-memory, not saved to Laravel, lost on restart, reset by refetch | PASS | `README.md:50-56`. All four points are stated, plus the 422 for malformed ids. E2E confirms that a refetch shows Laravel's `pending` |

### Human decisions

| Decision | Verdict | Evidence |
| --- | --- | --- |
| Tailwind v4 via `@tailwindcss/vite`, no `@nuxtjs/tailwindcss` | PASS | `package.json` deps `@tailwindcss/vite`/`tailwindcss` ^4.3.3; `nuxt.config.ts:2,14`; module absent |
| Plain Vitest, 4 devDeps, no `@nuxt/test-utils`/`unplugin-auto-import` | PASS | devDependencies are exactly `vitest`, `@vue/test-utils`, `@vitejs/plugin-vue`, `happy-dom`; `vitest.config.ts` happy-dom |
| Campaign-wide summary | PASS | `server/mock/applicant-summary.ts:53-64` uses `all`. E2E proxy min_score=90 → `total_applicants` 40, `pagination.total` 6 |
| Order `ai_score DESC, id ASC` | PASS | `applicant-summary.ts:41,61`. E2E proxy: 34(99), 29(98), **2(95), 12(95)** (tie broken by id ASC), 10(93), 26(91) |
| Token server-only | PASS | `nuxt.config.ts:7-10` not under `public`. `grep -rlE 'demo-partner-token\|backendUrl\|partnerToken\|X-Partner-Token\|NUXT_BACKEND' .output/public` → no hit. SSR HTML from :3797 has 0 matches for `qa-rerun-token\|8797\|backendUrl\|partnerToken`. The token default exists only in `.output/server/chunks/nitro/nitro.mjs` |
| Proxy GET only / PATCH never reaches Laravel (Decision A) | PASS | See the resolution table |

**Observation (not a defect, within the decided scope):** `proxyStatuses` (`status-update.ts:10`) is written but never read, because Decision A doesn't overlay it on GET. This matches the README and is marked with a `ponytail:` comment (:4).

### Gate verdict

**PASS.** All 9 FR-F rows, all 5 PRD-E2 criteria, all 6 resolution checks and all 6 decision rows PASS. vitest 15/15, vue-tsc 0, build OK, backend 30/30, 0 typing escapes. P2 may close.

## P2 closed — 2026-10-14

code-reviewer: no blockers; one major settled by a human decision (scoped proxy); minor findings fixed. qa-gate: FAIL (PATCH in proxy mode), fixed under Decision A, re-run PASS on FR-F1–F9 and PRD-E2. Orchestrator re-ran both suites: green.

## P3 authorized — 2026-10-14

## Decision — Task 4 queue backbone at 50x — 2026-10-14

**Options presented:** A) Redis Streams (FR-R4; about 30 min of in-memory backlog at 50x); B) Google Pub/Sub (FR-R4; managed, days of retention); C) managed Kafka (outside FR-R4).
**Choice:** B (human), overriding the draft's A.
**Rationale (human, verbatim):** "The brief itself signals the platform: Task 4 names Cloud Pub/Sub and Cloud Tasks as example tech, and the backend ships Google Gemini integrations, which resolves the "if on GCP" conditional to B. The decisive argument is failure-class: the RCA is an in-memory buffer exhausted under a viral spike; Redis Streams at 50x holds ~30 min of in-memory backlog, so any consumer outage longer than that during the next spike loses billing-grade events again — the same failure mode one layer up. Pub/Sub gives days of retention, managed autoscaling and replay; its at-least-once delivery is already absorbed by the idempotent consumer keyed by event_id that FR-R4 mandates. Redis stays in the design as cache, decoupled from the billing pipeline. Kafka remains rejected: outside FR-R4, more operational surface than 50x needs."

## Decision — Task 4 /api/trk durability within 1 hour — 2026-10-14

**Options presented:** A) temporarily sample non-billable events only (config); B) in-process buffer in Nitro (code hotfix); C) log-shipper sidecar with a disk buffer, e.g. Vector (new dependency).
**Choice:** A (human).
**Rationale (human, verbatim):** "the only config-only option per FR-R3. Trade-off stated honestly: analytics fidelity degrades during the incident window; billing integrity never does. B is a code hotfix under incident pressure; C can't be stood up safely inside an hour."

## Decision — Task 4 capacity numbers and TTL source — 2026-10-14

**30 min TTL:** confirmed by the human as in the original brief (Stack Context: "TTL: 30m, MaxKeys: 50"), so the "Brief" label stays.
**Capacity numbers:** keep them, but label every figure as a stated assumption with the math shown.
**Rationale (human, verbatim):** "the brief gives no traffic volumes; 1,000 events/s baseline is ours. An analysis that shows its assumptions beats one that hides them."

## 2026-10-15 — P3 architecture — Task 4 draft (docs/task4-architecture.md)

**Prompt 1 (verbatim excerpt, orchestrator → architecture-analyst):**
```text
Draft Task 4 into `docs/task4-architecture.md`, covering FR-R2 to FR-R5 [...] 50x proposal (FR-R4): stay within FR-R4's technology choices [...] If you think a technology outside FR-R4 is warranted, do NOT write it in as the proposal. List it under a final "Open decisions for the human" section with 3 genuinely different options and pros and cons.
```
**Raw output 1 (summary; the file was later revised in place, so the first draft is not preserved verbatim):** Redis Streams as the queue (sharded by event_id), Redis `SET NX` dedupe in the consumer, an accepted under-count window between "seen" and the outbox write, and capacity of 4 Redis shards / ~45 GB / 30 min backlog at an assumed P = 1,000 events/s. Two open decisions were raised (queue backbone; 1-hour /api/trk buffer). It also flagged that the 30 min TTL was labelled "Brief" without an FRD source.

**Prompt 2 (verbatim excerpt):**
```text
Revise [...] to apply the human's decisions [...] Queue → Google Pub/Sub everywhere [...] The 1-hour /api/trk step uses sampling of non-billable events only [...] Capacity numbers: keep them, but mark every figure as a stated assumption and show the math.
```
**Refactor notes (human + orchestrator judgment):**
- The human overrode the queue (Redis Streams → Pub/Sub) on a failure-class argument: a 30 min in-memory backlog repeats the RCA one layer up.
- Unrequested change by the agent: because Redis became cache-only, it moved dedupe from Redis `SET NX` to a `billable_events` table with `ON CONFLICT DO NOTHING`, in the same transaction as the outbox. This closes the under-count window. Pending human confirmation.
- Orchestrator verification: Pub/Sub throughout (Redis only as cache, or as the comparison in 3.1/3.2), dead-letter topic plus seek replay present, 30 min TTL labelled Brief, capacity math in 3.1 re-computed and correct, Mermaid block parsed OK with mermaid@11.4.1 (with a negative control).

## Decision — billable_events dedupe table (agent-proposed, approved with conditions) — 2026-10-15

**Origin:** an unrequested design change by `architecture-analyst` during the P3 revision. Once Redis was demoted to cache-only, it moved consumer dedupe from Redis `SET NX` to a `billable_events` table (`ON CONFLICT (event_id) DO NOTHING`) in the same transaction as the outbox row.
**Choice:** approved with conditions (human).
**Rationale (human, verbatim):** "the billable_events dedup table is the correct extension of the failure-class principle: with Redis demoted to cache, dedup state cannot live there, and a unique constraint inside the same transaction as the outbox row is the only transactionally-guaranteed dedup."
**Conditions (human):**
a) Partition the table by day, so retention means dropping a partition, not a DELETE of millions of rows; the unique index on event_id is the actual mechanism.
b) State the invariant explicitly: dedupe retention window ≥ maximum replay window (7-day Pub/Sub retention + 1 day margin = 8 days). "If replay can reach further back than dedup remembers, replay double-bills. That sentence is the design."
c) Derive the row count from A4 and show the math, consistent with section 3.1.
d) Log it here as an agent-proposed design change approved with conditions (this entry).

**Also approved (human):**
- Assumptions A4 (5% billable) and ~200 KB per compiled variant, as labelled. Add one sensitivity line: if the billable share doubles to 10%, the dedupe table and billing write throughput double; name which component feels it first.
- Label the "about 5 to 10×" sampling reduction as an assumption.
- On exactly-once: do not just drop "paid". State that we do NOT rely on Pub/Sub exactly-once delivery (regional, caveated); the idempotent consumer remains the correctness guarantee, and exactly-once is at best an optimization.

**Hold:** P4 waits for the human's own edit pass on the draft.

## 2026-10-15 — P3 architecture — conditions applied (verification)

Orchestrator checked docs/task4-architecture.md on disk: all 7 edits present; the word "paid" removed; math re-computed (520 M / 1.7 B / 1.04 B rows; sampling 5.3–6.9×); Mermaid re-parsed OK (mermaid@11.4.1, negative control). Agent choices left for the human: the UUIDv7 timestamp rule sits in the Consumer row rather than the /api/trk row; reject rather than clamp (clamping changes event_id across retries and breaks dedupe). P4 on hold for the human edit pass.

## Human edit pass — P3 Task 4 draft — 2026-10-15 (human-authored)

**Agreements (human, one-line reasons):**
1. **Reject, don't clamp** out-of-window timestamps: "clamping forges a new event_id and defeats dedup".
2. **Move the timestamp check to the `/api/trk` row:** that's where it runs.
3. **Change the sampling headline to "about 5 to 7×":** so it matches our own maths (5.3–6.9×).

**Human edit — the rejection rule is derived from invariant b (verbatim):**
"the rejection rule must be DERIVED from invariant b, not chosen arbitrarily. /api/trk rejects events whose embedded timestamp is older than the dedup retention window minus one day of margin (7 days), because an older event maps to an already-dropped partition — dedup cannot remember it, so a replay would double-bill. It also rejects timestamps more than 15 minutes in the future (SDK clock skew), which would write into a not-yet-current partition. One sentence in the doc: "the ingestion timestamp window is not input validation — it is the enforcement mechanism of the dedup invariant." Rejected events get a 4xx with a machine-readable reason so SDKs can surface it."

This closes the human edit pass. P4 authorized.

## P3 closed — 2026-10-15

Human edit pass applied and verified on disk: timestamp rule moved to the /api/trk row (7 days / +15 min, reject never clamp, 4xx with errors[].code), the human sentence present, sampling headline "about 5 to 7×", Mermaid re-parsed OK. Agent additions not dictated by the human: the trade-off line "Events outside the window are lost by design; that is explicit, counted loss instead of a silent double-bill.", the SDK-row note, and "The" capitalised at the start of the human sentence.

## P4 authorized — 2026-10-15

## Correction — P0 timestamps — 2026-10-15

The four P0 entry headers (20:15, 20:25, 20:40, 20:55) were written by the orchestrator without reading the clock. They are wrong and are left unedited because this log is append-only. File modification times give the real P0 timeline:
- 20:04 kit in place (CLAUDE.md)
- 20:08 campaigns migration created
- 20:16 applicants migration last modified (ai_score CHECK applied, P0 closed)
- 20:20 P1 ApplicantSummaryService created; 20:26 P1 review fixes (ApiException)
- 20:41 P2 starts (frontend package-lock.json)
- 22:55–22:58 P2 qa-gate fix
- 2026-10-15 08:51 task4-architecture.md last modified (P3 end); 08:57 TASK_REPORT.md written (P4)
Velocity figures must use these times, not the four P0 headers. Subagent-written headers (P1, P2) match the file times.

## Decision — submission packaging — 2026-10-15 (human)

- Rename README-KIT.md to docs/WORKFLOW.md and link it from the README. Task 3 summarizes the pipeline in one paragraph and points there.
- Add TASK_REPORT.md to the README layout table.
- Initialize git: write a .gitignore first, then 4–6 logical commits (kit/docs, backend, frontend, task4 + report). The report says the commit history was consolidated at submission and that the true development timeline is docs/AI_LOG.md.
- Delete backend/database/database.sqlite.
- Timing section: keep the gaps as stated, and add one sentence distinguishing wall clock from active time. The P2 1 h 41 min gap was the human's machine asleep, not work.
- After the human fills the 8 estimate placeholders: a final submission check. Report any failure instead of fixing it silently.

Applied by the orchestrator so far:
- The file was moved, and its trailing "can be renamed or folded" note was replaced with "(Linked from the root README.)".
- README row and link added.
- Root .gitignore written with the human's list, plus `*.sqlite`, `.output/` (Nuxt's build directory, the equivalent of dist/) and `.DS_Store`. The backend/ and frontend/ .gitignore files already covered these.
- database.sqlite deleted. `git init` run; no commits yet.

## P4 report edits — 2026-10-15

Human estimates and the speed-up paragraph inserted verbatim in 2.7. Orchestrator edits: 2.1 condensed to one paragraph pointing to docs/WORKFLOW.md (flowchart kept); 2.7 commit-history line, wall-clock vs active-time note, and the P2 gap relabelled as the machine asleep; section 5 notes updated. Flagged to the human, not changed: "nine ADRs" vs 15 Decision entries in this log, and "~4 h active time", which the log cannot derive. Holding before commits for the human evaluator read.

## Human text corrected — 2026-10-15

Two phrases in the human-written velocity text were corrected at the human's request after an evidence check against the log: "the nine ADRs" became "the 15 recorded decisions" (the log has 15 `## Decision` entries), and "~4 h active time" became an explicit estimate (the log cannot measure it). The check was made by the orchestrator (main session), not by report-writer.

## Final submission check (fresh clone) — 2026-10-15

Run by the orchestrator on a fresh `git clone` of the 4 commits:
- `composer install` → `php artisan test` (no `.env`): **FAIL**, 30 warnings (229 assertions, 0 passed). Each test reported `file_get_contents(.../backend/.env): Failed to open stream`.
- README steps (`cp .env.example .env`, `key:generate`, test): PASS, 30 passed (229 assertions).
- `npm ci` → `npx vitest run`: PASS, 15 passed (15).
- Task 3 prompts verbatim in this log: PASS, 3 of 3 exact.
- Both diagrams rendered with @mermaid-js/mermaid-cli@11.4.2 and inspected visually: PASS.
- Required structure present, no `.env`/database/vendor/node_modules/build output tracked: PASS.

## Diagnosis correction — backend test warnings — 2026-10-15

**Human hypothesis (verbatim):** "stock Laravel never does that (phpdotenv skips a missing .env; phpunit.xml provides test env vars), so something custom is reading the file directly."
**Disproven by the trace (made by the orchestrator, file:line):**
- Nothing custom reads `.env`. Each test boots the app, and `LoadEnvironmentVariables.php:29` calls phpdotenv `safeLoad()`, which reads with error suppression: `@\file_get_contents($path)` (`vlucas/phpdotenv/src/Store/File/Reader.php:73`).
- PHPUnit records the suppressed warning as an event flagged `wasSuppressed()`, and its own printer ignores it: `vendor/bin/phpunit` → OK (30 tests, 229 assertions).
- Collision's `DefaultPrinter::testPhpWarningTriggered()` (`DefaultPrinter.php:351`, Collision 8.9.5, latest stable) never checks `wasSuppressed()`, so it reports the suppressed warning as a test warning.
- A `.env.testing` prototype in the scratch clone gave 30 passed from a bare install.
**Lesson:** evidence over confident assertion, including the human's.

## Decision — Collision suppressed-warning workaround — 2026-10-15

**Options presented:** A) a comment-only `backend/.env.testing` (Laravel loads it because phpunit.xml sets APP_ENV=testing); B) a `createApplication()` override that skips the env file when it is missing; C) document only.
**Choice:** A (human), with conditions:
1. The file is comment-only and self-documenting: its first line says it exists to work around the Collision bug, with the trace reference (DefaultPrinter.php:351, Collision 8.9.5, missing `wasSuppressed()` check).
2. `.gitignore` must not match `.env.testing`: add an explicit `!backend/.env.testing` negation if any `.env*` pattern exists, and confirm the file survives a fresh clone.
3. One sentence in the report's setup section: "vendor/bin/phpunit runs clean; the warnings under php artisan test without an env file are a Collision printer bug (reported suppressed warnings), worked around with a comment-only .env.testing."
Then: the fix goes through backend-laravel, code-reviewer and qa-gate; the 5th commit is "final submission check"; the fresh-clone check is re-run, and the check that failed must be the one that passes.

## Final check fix — backend/.env.testing — 2026-10-15

**Prompt (verbatim):**
```text
Small final fix in /Users/fernandoviviurka/Desktop/Projetos/b2b-fullstack-task-submission (a git repo with 4 commits). First read the last three entries in docs/AI_LOG.md: `Final submission check (fresh clone)`, `Diagnosis correction — backend test warnings` and `Decision — Collision suppressed-warning workaround`.

Implement Decision A exactly:
1. **Create `backend/.env.testing`, comments only, with no variables.** Its first line must say it exists only to work around a dependency bug. The header explains:
   - phpdotenv's error-suppressed read (`@file_get_contents`, `vlucas/phpdotenv/src/Store/File/Reader.php:73`, reached via Laravel's `LoadEnvironmentVariables` `safeLoad()`) needs a file to find;
   - Collision 8.9.5's `DefaultPrinter::testPhpWarningTriggered()` (`DefaultPrinter.php:351`) reports suppressed PHP warnings without checking `wasSuppressed()`, so `php artisan test` without an env file shows every test as a warning;
   - Laravel loads `.env.testing` because phpunit.xml sets `APP_ENV=testing`;
   - test values live in phpunit.xml `<env>`, so never put secrets or variables here;
   - it can be deleted once Collision checks `wasSuppressed()`.
   Keep it short.
2. **Check `.gitignore`.** Look at the root `.gitignore` and `backend/.gitignore` for any pattern that would match `.env.testing` (e.g. `.env*`, `.env.*`). If one exists, add an explicit `!backend/.env.testing` (root) or `!.env.testing` (backend) negation. Prove it with `git check-ignore -v backend/.env.testing`, which must report nothing, and with `git status` showing the file as untracked.
3. **Verify** without a `backend/.env`: rename the local one aside temporarily if it exists, and restore it afterwards. `php artisan test` must give 30 passed (229 assertions) with 0 warnings, and `vendor/bin/phpunit` must still be OK. Also run with the local `.env` restored, to show nothing changed for normal use.

Don't touch any other file, and don't commit. Log per the ai-evidence-log skill: one AI_LOG entry `Final check fix — backend/.env.testing` with this prompt and the file content. Report the file content, the gitignore findings and the test output.
```

**Raw output — `backend/.env.testing` (comments only, no variables):**
```text
# This file exists only to work around a dependency bug (Collision 8.9.5).
#
# Laravel's LoadEnvironmentVariables calls phpdotenv safeLoad(), which reads the
# env file with error suppression: @file_get_contents
# (vlucas/phpdotenv/src/Store/File/Reader.php:73). With no env file, that read
# raises a suppressed PHP warning. Collision's
# DefaultPrinter::testPhpWarningTriggered() (DefaultPrinter.php:351) reports it
# without checking wasSuppressed(), so `php artisan test` shows every test as a
# warning. Laravel loads this file because phpunit.xml sets APP_ENV=testing.
#
# Test values live in phpunit.xml <env>: never put secrets or variables here.
# Delete this file once Collision checks wasSuppressed().
```

**Gitignore:** neither root `.gitignore` nor `backend/.gitignore` matches `.env.testing` (both list only the exact names `.env`, plus `.env.backup` and `.env.production` in backend), so no negation was added. `git check-ignore -v backend/.env.testing` reported nothing (exit 1); `git status` shows `?? backend/.env.testing`.

**Verification:** with `backend/.env` moved aside, `php artisan test` gave 30 passed (229 assertions) and 0 warnings, and `vendor/bin/phpunit` gave OK (30 tests, 229 assertions). After restoring `.env`, both runners gave the same results. No other file touched, no commit.

## Review findings — final check fix — 2026-10-15

Scope: `backend/.env.testing` (new), TASK_REPORT.md §1.3 (lines 75, 77), AI_LOG entries from `Final submission check (fresh clone)` onwards. Reviewer: code-reviewer.

**Claims verified against `backend/vendor` (all TRUE):**
- `vendor/vlucas/phpdotenv/src/Store/File/Reader.php:73` is `Option::fromValue(@\file_get_contents($path), false)` (phpdotenv v5.7.0).
- `vendor/laravel/framework/src/Illuminate/Foundation/Bootstrap/LoadEnvironmentVariables.php:29` is `$this->createDotenv($app)->safeLoad();` (Laravel v11.57.0). `checkForSpecificEnvironmentFile()` (same file, ~l.52-55) switches to `.env.<APP_ENV>` only if that file exists.
- `vendor/nunomaduro/collision/src/Adapters/Phpunit/Printers/DefaultPrinter.php:351` is `testPhpWarningTriggered()`; it adds `TestResult::WARN` with no `wasSuppressed()` check; `grep wasSuppressed` over Collision's src returns nothing.
- PHPUnit 11.5.57 `PhpWarningTriggered::wasSuppressed()` exists (l.96) and PHPUnit's own `ProgressPrinter.php:226` skips suppressed warnings, which matches "vendor/bin/phpunit runs clean".
- `phpunit.xml:21` sets `APP_ENV=testing`. Collision is v8.9.5 in composer.lock and installed.json; `composer show --latest` reports latest v8.9.5, so "latest stable" holds.

**Checks run:**
- File: 12 lines, all `#` comments, no variables or secrets. Line 1 names the workaround: "This file exists only to work around a dependency bug (Collision 8.9.5)."
- `git check-ignore -v backend/.env.testing`: no output, exit 1. Root `.gitignore:6` and `backend/.gitignore:9-11` list exact names only.
- `backend/.env` moved aside: `php artisan test` gave 30 passed (229 assertions) and 0 warnings; `vendor/bin/phpunit` gave OK (30 tests, 229 assertions). Negative control with `.env.testing` also removed: 30 warnings (229 assertions), so the file is the cause of the fix. `.env` restored: 30 passed (229 assertions).
- Outside tests: with the default `.env` (APP_ENV=local), `config('app.env')` = local and `app.key` is set, so `serve` and `migrate` are unaffected. `.env.testing` is only selected when APP_ENV=testing comes from the process env or with `--env=testing`.

**Findings:**
1. TASK_REPORT.md:374 (and the §2.5 table, TASK_REPORT.md:295-313) · The report says "the 15 recorded decisions", and §2.5 says "Every row is a `## Decision` entry". The new `## Decision — Collision suppressed-warning workaround` (AI_LOG.md:2863) makes it 16 `## Decision` headers (HEAD had 15), and §2.5 has no row for this decision. A report statement is now false. · **med** · Change the count to 16 and add row 16 to §2.5: Collision workaround | A comment-only `.env.testing`; B `createApplication()` override; C document only | A with 3 conditions | Human. (Separately, and already true before this change: the 15 table rows do not map 1:1 to the `## Decision` headers. Row 15 comes from the human edit pass, and `submission packaging` has no row. Worth one pass.)
2. backend/.env.testing:9 · The header says Laravel "loads this file" but not that it replaces `.env` for every APP_ENV=testing run. Tests now ignore local `.env` entirely. Probe: `APP_ENV=testing php artisan tinker` gives `app.key` EMPTY even with `.env` present. Before the fix, tests inherited `APP_KEY` and the other values from `.env`. Nothing breaks today: the suite passed with no `.env` under phpunit, so it was already independent of `.env`. A future test that touches encryption (cookies, encrypted casts, signed URLs) would throw MissingAppKeyException even though the developer has a `.env`. AI_LOG.md:2909 "to show nothing changed for normal use" is true for `serve`, but the env source for tests did change. · **low** · Add one header line: "It also shadows .env under APP_ENV=testing; add any test-only value to phpunit.xml <env>." Do not add a key now (YAGNI).
3. TASK_REPORT.md:77 · Changing "changed no code" to "changed no application code" is not needed. P3 and P4 wrote only docs, and `.env.testing` comes from the post-P4 final check, so both versions are true. Also, "Source: `## QA gate (re-run) — P2 frontend`… the last gate entry that ran both suites" goes stale as soon as the final-check qa-gate runs both suites. · **low** · After the qa-gate entry exists, point Source at it, or add "and the final-check gate".
4. docs/AI_LOG.md:2874 (`## Final check fix — backend/.env.testing — 2026-10-15`) · The header has no time and does not name the agent that produced the raw output. The ai-evidence-log skill asks for rough per-phase timestamps, and the P0 timestamp correction (AI_LOG.md ~2808) shows why that matters. · **low** · Do not edit the entry (append-only). If a time is needed later, record the file mtime of `backend/.env.testing` (Oct 15 10:37) in the next entry.
5. TASK_REPORT.md:75 · Consistent with the log and with Decision condition 3. The wording matches the human's sentence except for added backticks. "Without an env file" means without both `.env` and `.env.testing`. That is accurate, given that the file now exists. · **none**

**Categories with no findings:** N+1 / PHP-loop aggregation: none, no application code changed. Null/empty states: none. Type gaps: none, no TS/PHP touched. A11y: none, no UI. Security: none. The file holds no values, the header forbids secrets, and the gitignore exact-name entries keep real `.env` files ignored. Test gaps: none. The fix is verified by a negative control, and no test can assert on a printer bug. JSON:API contract drift: none.

**Verdict:** PASS with one medium doc fix. Every file:line and version claim in the header and the diagnosis trace is true against `backend/vendor`. The file is comment-only and not ignored. It turns the fresh-clone failure into 30 passed with 0 warnings, and the negative control shows it is the cause. It does not affect `serve` or `migrate` under the normal `.env`. Before submission, fix finding 1: the report's "15 recorded decisions" and the §2.5 table are now contradicted by the 16th `## Decision` entry. Finding 2 is a one-line header clarification. Findings 3-4 are optional.

## Final check fix — .env.testing header (review finding 2) — 2026-10-15 10:40

Agent: backend-laravel. Change: comment-only edit to `backend/.env.testing`. Line 1 is unchanged and still names the Collision workaround. No variables were added, no other file was touched, and nothing was committed.

```diff
--- a/backend/.env.testing
+++ b/backend/.env.testing
@@ -8,5 +8,7 @@
 # without checking wasSuppressed(), so `php artisan test` shows every test as a
 # warning. Laravel loads this file because phpunit.xml sets APP_ENV=testing.
 #
-# Test values live in phpunit.xml <env>: never put secrets or variables here.
+# With APP_ENV=testing this file replaces .env for every test run: tests see no
+# .env value, including APP_KEY. Test-only values belong in phpunit.xml <env>;
+# never put secrets or variables here.
 # Delete this file once Collision checks wasSuppressed().
```

Verification: with `backend/.env` present, `php artisan test` gave 30 passed (229 assertions). With `.env` moved aside, it gave 30 passed (229 assertions) and 0 warnings. `.env` was then restored.

Review finding 4: backend-laravel produced the earlier `## Final check fix — backend/.env.testing` entry at about 2026-10-15 10:37, which is the mtime of `backend/.env.testing` before this edit.

## QA gate — final check fix — 2026-10-15

Scope: uncommitted changes on top of 4 commits (`TASK_REPORT.md`, `docs/AI_LOG.md` modified; `backend/.env.testing` untracked). Agent: qa-gate. No file modified except this entry.

| Item | Verdict | Evidence | Note |
| --- | --- | --- | --- |
| 1a `.env.testing` comment-only, line 1 names workaround, trace true | PASS | `backend/.env.testing` 14 lines, 0 non-comment lines; l.1 "exists only to work around a dependency bug (Collision 8.9.5)". `vendor/vlucas/phpdotenv/src/Store/File/Reader.php:73` = `@\file_get_contents($path)`; `LoadEnvironmentVariables.php:29` = `safeLoad()`; `collision/.../DefaultPrinter.php:351` = `testPhpWarningTriggered()`, adds `TestResult::WARN`; `grep wasSuppressed` over Collision src = 0; composer.lock collision v8.9.5; `phpunit.xml:21` APP_ENV=testing | |
| 1b not gitignored | PASS | `git check-ignore -v backend/.env.testing` → no output, exit 1; `git status` → untracked | |
| 1c human sentence in §1.3 | PASS | TASK_REPORT.md:75, matches Decision condition 3 word for word (backticks added only) | |
| 2 finding 1 (§2.5 1:1, count 16) | PASS | 16 `^## Decision` headers (AI_LOG.md:91…2863) map in order to §2.5 rows 1–16 (row 15 submission packaging, row 16 Collision workaround); edit pass moved to a line below the table; TASK_REPORT.md:377 "the 16 recorded decisions"; §3.5 reference updated to rows 11–14 + edit-pass line | |
| 2 finding 2 (header line) | PASS | `backend/.env.testing:11-13` states it replaces .env under APP_ENV=testing, incl. APP_KEY | |
| 2 finding 4 (time/agent noted) | PASS | `## Final check fix — .env.testing header … 10:40`, last paragraph: backend-laravel, ~10:37 | |
| 2 finding 3 ("Source:" line) | PENDING (deferred, as instructed) | TASK_REPORT.md:77 still cites `## QA gate (re-run) — P2 frontend` | orchestrator to point it at this entry |
| 3 backend, no `.env` | PASS | `.env` moved to scratchpad; `php artisan test` → Tests: 30 passed (229 assertions), no warnings; `vendor/bin/phpunit` → OK (30 tests, 229 assertions) | |
| 3 backend, `.env` restored | PASS | `.env` back (1150 bytes, Oct 14 20:06); `php artisan test` → 30 passed (229 assertions) | |
| 3 frontend | PASS | `npx vitest run` → Test Files 3 passed (3), Tests 15 passed (15) | |
| 4 §2.2 prompts verbatim | PASS | all 3 ```text blocks in §2.2 found as exact substrings of AI_LOG.md (scripted check: [True, True, True]) | |
| 5 Mermaid | PASS | TASK_REPORT.md has 2 mermaid blocks; 2nd (sequenceDiagram) is byte-identical to the one in docs/task4-architecture.md (`diff` empty); `git diff HEAD -- TASK_REPORT.md` touches no mermaid lines | |

**Overall: PASS.** Finding 3 remains open for the orchestrator (not a gate blocker by instruction).

## Review finding 3 resolved — 2026-10-15

Orchestrator updated the TASK_REPORT.md section 1.3 "Source:" line to cite `QA gate — final check fix — 2026-10-15`. The 5th commit ("final submission check") follows, then the fresh-clone check is re-run.
