<?php

namespace App\Application\Apelaciones\Handlers;

use App\Application\Apelaciones\Queries\ListarApelacionesPorEstudianteQuery;
use App\Domain\Apelaciones\Entities\Apelacion;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;

final class ListarApelacionesPorEstudianteHandler
{
    public function __construct(private readonly ApelacionRepository $apelaciones)
    {
    }

    /** @return iterable<Apelacion> */
    public function handle(ListarApelacionesPorEstudianteQuery $query): iterable
    {
        return $this->apelaciones->listarFinalesPorEstudiante($query->estudianteId());
    }
}
