<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
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
            throw new ApiException(401, 'Missing or empty X-Partner-Token header.');
        }

        return $next($request);
    }
}
