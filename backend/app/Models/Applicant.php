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
