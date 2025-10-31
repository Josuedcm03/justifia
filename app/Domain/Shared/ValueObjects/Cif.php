<?php

namespace App\Domain\Shared\ValueObjects;

use App\Domain\Shared\DomainException;

final class Cif
{
    private string $value;

    public function __construct(string $value)
    {
        $value = strtoupper(trim($value));

        if ($value === '') {
            throw DomainException::withMessage('El CIF es obligatorio.');
        }

        if (! preg_match('/^[A-Z0-9\-]+$/', $value)) {
            throw DomainException::withMessage(
                'El CIF solo puede contener letras, números y guiones.',
                ['cif' => $value],
            );
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
