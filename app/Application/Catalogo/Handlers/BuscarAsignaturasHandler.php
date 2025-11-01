<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Queries\BuscarAsignaturasQuery;
use App\Domain\Catalogo\Entities\Asignatura;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;

final class BuscarAsignaturasHandler
{
    public function __construct(private readonly AsignaturaRepository $asignaturas)
    {
    }

    /** @return iterable<Asignatura> */
    public function handle(BuscarAsignaturasQuery $query): iterable
    {
        return $this->asignaturas->search($query->termino(), $query->facultadId(), $query->limit());
    }
}
