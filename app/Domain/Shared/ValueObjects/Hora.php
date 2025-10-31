<?php

namespace App\Domain\Shared\ValueObjects;

use DateTimeImmutable;
use InvalidArgumentException;

final class Hora
{
    private string $value;

    public function __construct(string $value)
    {
        $value = trim($value);

        if ($value === '') {
            throw new InvalidArgumentException('La hora es obligatoria.');
        }

        $hora = DateTimeImmutable::createFromFormat('H:i', $value);

        if (! $hora || $hora->format('H:i') !== $value) {
            throw new InvalidArgumentException('La hora debe tener el formato HH:MM.');
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
