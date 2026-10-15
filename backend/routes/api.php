<?php

use App\Http\Controllers\ApplicantSummaryController;
use App\Http\Middleware\EnsurePartnerToken;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware(EnsurePartnerToken::class)->group(function () {
    Route::get('campaigns/{campaignId}/applicant-summary', ApplicantSummaryController::class);
});
