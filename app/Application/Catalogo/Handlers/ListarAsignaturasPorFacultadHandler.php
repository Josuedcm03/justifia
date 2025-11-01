<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Queries\ListarAsignaturasPorFacultadQuery;
use App\Domain\Catalogo\Entities\Asignatura;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;

final class ListarAsignaturasPorFacultadHandler
{
    public function __construct(private readonly AsignaturaRepository $asignaturas)
    {
    }

    /** @return iterable<Asignatura> */
    public function handle(ListarAsignaturasPorFacultadQuery $query): iterable
    {
        return $this->asignaturas->listByFacultad($query->facultadId());
    }
}
