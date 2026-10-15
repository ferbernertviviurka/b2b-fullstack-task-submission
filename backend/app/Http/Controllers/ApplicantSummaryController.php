<?php

namespace App\Http\Controllers;

use App\Http\Requests\ApplicantSummaryRequest;
use App\Http\Resources\ApplicantResource;
use App\Services\ApplicantSummaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;

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
        // Built from APP_URL, never from the client-controlled Host header (TrustHosts is off under local/testing).
        $base = rtrim(config('app.url'), '/').'/'.$request->path();
        $url = fn (int $number) => $base.'?'.Arr::query([...$request->query(), 'page' => ['number' => $number, 'size' => $page->perPage()]]);

        return [
            'first' => $url(1),
            'last' => $url($page->lastPage()),
            // Past the end, prev points back to the last real page rather than another empty one.
            'prev' => $page->currentPage() > 1 ? $url(min($page->currentPage() - 1, $page->lastPage())) : null,
            'next' => $page->hasMorePages() ? $url($page->currentPage() + 1) : null,
        ];
    }
}
