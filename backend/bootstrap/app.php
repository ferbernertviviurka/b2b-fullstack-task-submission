<?php

use App\Exceptions\ApiException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        //
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // FR-B7: every API error is a JSON:API errors[] document, never HTML or a bare message.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            if ($e instanceof ValidationException) {
                $errors = array_map(fn (string $detail) => [
                    'status' => '422',
                    'title' => 'Invalid parameter',
                    'detail' => $detail,
                ], array_merge(...array_values($e->errors())));

                return new JsonResponse(['errors' => $errors], 422, ['Content-Type' => 'application/vnd.api+json']);
            }

            $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : 500;
            $title = Response::$statusTexts[$status] ?? 'Error';
            // Only messages we wrote reach the client; framework messages (route paths, model classes) and 500s get the generic title.
            $detail = $e instanceof ApiException && $status < 500 ? $e->getMessage() : $title;
            // Keep the exception's own headers, e.g. `Allow` on a 405.
            $headers = $e instanceof HttpExceptionInterface ? $e->getHeaders() : [];

            return new JsonResponse(
                ['errors' => [['status' => (string) $status, 'title' => $title, 'detail' => $detail]]],
                $status,
                [...$headers, 'Content-Type' => 'application/vnd.api+json'],
            );
        });
    })->create();
