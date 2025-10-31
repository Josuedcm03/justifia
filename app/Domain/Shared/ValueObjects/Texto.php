<?php

namespace App\Domain\Shared\ValueObjects;

use App\Domain\Shared\DomainException;

final class Texto
{
    private string $value;

    public function __construct(string $value, bool $allowEmpty = false, int $maxLength = 2000)
    {
        $value = trim($value);

        if (! $allowEmpty && $value === '') {
            throw DomainException::withMessage('El texto no puede estar vacío.');
        }

        if (mb_strlen($value) > $maxLength) {
            throw DomainException::withMessage(
                'El texto supera el largo permitido.',
                ['texto' => $value, 'maxLength' => $maxLength],
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
