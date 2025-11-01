<?php

namespace App\Application\Reprogramaciones\DTOs;

final class DocenteIdDTO
{
    public function __construct(private readonly int $docenteId)
    {
    }

    public function docenteId(): int
    {
        return $this->docenteId;
    }
}
