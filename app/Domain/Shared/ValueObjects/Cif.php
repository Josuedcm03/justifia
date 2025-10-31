<?php

namespace App\Domain\Shared\ValueObjects;

use InvalidArgumentException;

final class Cif
{
    private string $value;

    public function __construct(string $value)
    {
        $value = strtoupper(trim($value));

        if ($value === '') {
            throw new InvalidArgumentException('El CIF es obligatorio.');
        }

        if (! preg_match('/^[A-Z0-9\-]+$/', $value)) {
            throw new InvalidArgumentException('El CIF solo puede contener letras, números y guiones.');
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
