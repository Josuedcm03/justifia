<?php

namespace App\Application\Apelaciones\DTOs;

final class ApelacionesPorEstudianteDTO
{
    public function __construct(private readonly int $estudianteId)
    {
    }

    public function estudianteId(): int
    {
        return $this->estudianteId;
    }
}
