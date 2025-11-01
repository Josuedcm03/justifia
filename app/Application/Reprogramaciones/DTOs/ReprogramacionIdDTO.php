<?php

namespace App\Application\Reprogramaciones\DTOs;

final class ReprogramacionIdDTO
{
    public function __construct(private readonly int $reprogramacionId)
    {
    }

    public function reprogramacionId(): int
    {
        return $this->reprogramacionId;
    }
}
