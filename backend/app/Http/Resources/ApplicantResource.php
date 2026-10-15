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
