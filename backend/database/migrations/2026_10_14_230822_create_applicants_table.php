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
            // Blueprint has no check() in Laravel 11; rawColumn inlines the CHECK into CREATE TABLE (SQLite + MySQL 8.0.16+).
            $table->rawColumn('ai_score', 'tinyint unsigned constraint applicants_ai_score_range check (ai_score between 0 and 100)');
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
