<?php

namespace App\Application\Catalogo\DTOs;

final class AsignaturasPorFacultadDTO
{
    public function __construct(private readonly int $facultadId)
    {
    }

    public function facultadId(): int
    {
        return $this->facultadId;
    }
}
