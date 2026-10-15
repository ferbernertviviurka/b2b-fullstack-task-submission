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
