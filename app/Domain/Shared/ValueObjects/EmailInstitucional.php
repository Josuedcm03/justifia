<?php

namespace App\Domain\Shared\ValueObjects;

use App\Domain\Shared\DomainException;

final class EmailInstitucional
{
    private string $value;

    public function __construct(string $value)
    {
        $value = strtolower(trim($value));

        if ($value === '') {
            throw DomainException::withMessage('El correo institucional es obligatorio.');
        }

        if (filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
            throw DomainException::withMessage(
                'El correo institucional proporcionado no es válido.',
                ['email' => $value],
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
