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
