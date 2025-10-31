<?php

namespace App\Domain\Shared\ValueObjects;

use App\Domain\Shared\DomainException;

final class EmailAddress
{
    private string $value;

    public function __construct(string $value)
    {
        $value = trim($value);

        if ($value === '') {
            throw DomainException::withMessage('El correo electrónico es obligatorio.');
        }

        if (! filter_var($value, FILTER_VALIDATE_EMAIL)) {
            throw DomainException::withMessage(
                'El correo electrónico no es válido.',
                ['email' => $value],
            );
        }

        $this->value = strtolower($value);
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
