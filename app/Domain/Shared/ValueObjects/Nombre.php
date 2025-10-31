<?php

namespace App\Domain\Shared\ValueObjects;

use App\Domain\Shared\DomainException;

final class Nombre
{
    private string $value;

    public function __construct(string $value)
    {
        $value = trim($value);

        if ($value === '') {
            throw DomainException::withMessage('El nombre es obligatorio.');
        }

        if (mb_strlen($value) > 255) {
            throw DomainException::withMessage(
                'El nombre no puede superar los 255 caracteres.',
                ['nombre' => $value],
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
