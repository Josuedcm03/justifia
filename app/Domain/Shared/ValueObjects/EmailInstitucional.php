<?php

namespace App\Domain\Shared\ValueObjects;

use InvalidArgumentException;

final class EmailInstitucional
{
    public function __construct(private readonly string $value)
    {
        if (filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('El correo institucional proporcionado no es válido.');
        }
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
