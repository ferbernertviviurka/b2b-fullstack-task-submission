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
