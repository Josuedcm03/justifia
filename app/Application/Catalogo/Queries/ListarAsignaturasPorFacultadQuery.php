<?php

namespace App\Application\Catalogo\Queries;

use App\Application\Catalogo\DTOs\AsignaturasPorFacultadDTO;

final class ListarAsignaturasPorFacultadQuery
{
    public function __construct(private readonly AsignaturasPorFacultadDTO $payload)
    {
    }

    public function facultadId(): int
    {
        return $this->payload->facultadId();
    }
}
