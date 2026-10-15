<?php

namespace App\Http\Requests;

use App\Exceptions\ApiException;
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
            // The cap keeps (number - 1) * size far from integer overflow.
            'page.number' => ['sometimes', 'integer', 'between:1,1000000'],
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

        return Campaign::find($id) ?? throw new ApiException(404, "Campaign {$id} not found.");
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
