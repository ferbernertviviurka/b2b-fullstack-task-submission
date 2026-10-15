<?php

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

/** An HTTP error raised by our own code: its message is written for clients and is safe to expose as `detail`. */
class ApiException extends HttpException {}
