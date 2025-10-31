<?php

namespace App\Domain\Shared\ValueObjects;

use App\Domain\Shared\DomainException;
use DateTimeImmutable;

final class Hora
{
    private string $value;

    public function __construct(string $value)
    {
        $value = trim($value);

        if ($value === '') {
            throw DomainException::withMessage('La hora es obligatoria.');
        }

        $hora = DateTimeImmutable::createFromFormat('H:i', $value);

        if (! $hora || $hora->format('H:i') !== $value) {
            throw DomainException::withMessage(
                'La hora debe tener el formato HH:MM.',
                ['hora' => $value],
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
