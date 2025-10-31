<?php

namespace App\Domain\Shared;

use InvalidArgumentException;
use Throwable;

class DomainException extends InvalidArgumentException
{
    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        string $message,
        private readonly array $context = [],
        int $code = 0,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $code, $previous);
    }

    /**
     * @return array<string, mixed>
     */
    public function context(): array
    {
        return $this->context;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public static function withMessage(string $message, array $context = []): self
    {
        return new self($message, $context);
    }
}
