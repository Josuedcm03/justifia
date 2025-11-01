<?php

namespace App\Application\Apelaciones\DTOs;

final class ApelacionIdDTO
{
    public function __construct(private readonly int $apelacionId)
    {
    }

    public function apelacionId(): int
    {
        return $this->apelacionId;
    }
}
