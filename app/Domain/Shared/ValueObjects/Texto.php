<?php

namespace App\Domain\Shared\ValueObjects;

use InvalidArgumentException;

final class Texto
{
    private string $value;

    public function __construct(string $value, bool $allowEmpty = false, int $maxLength = 2000)
    {
        $value = trim($value);

        if (! $allowEmpty && $value === '') {
            throw new InvalidArgumentException('El texto no puede estar vacío.');
        }

        if (mb_strlen($value) > $maxLength) {
            throw new InvalidArgumentException('El texto supera el largo permitido.');
        }

        $this->value = $value;
    }

    public function value(): string
    {
        return $this->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
