<?php

namespace App\Domain\Shared\ValueObjects;

use InvalidArgumentException;

final class EntityId
{
    private int $value;

    private function __construct(int $value)
    {
        if ($value <= 0) {
            throw new InvalidArgumentException('El identificador debe ser un entero positivo.');
        }

        $this->value = $value;
    }

    public static function fromInt(int $value): self
    {
        return new self($value);
    }

    public static function fromNullable(?int $value): ?self
    {
        if ($value === null) {
            return null;
        }

        return new self($value);
    }

    public function value(): int
    {
        return $this->value;
    }
}
