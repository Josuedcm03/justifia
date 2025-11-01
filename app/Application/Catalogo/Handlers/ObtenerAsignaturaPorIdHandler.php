<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Queries\ObtenerAsignaturaPorIdQuery;
use App\Domain\Catalogo\Entities\Asignatura;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;

final class ObtenerAsignaturaPorIdHandler
{
    public function __construct(private readonly AsignaturaRepository $asignaturas)
    {
    }

    public function handle(ObtenerAsignaturaPorIdQuery $query): Asignatura
    {
        return $this->asignaturas->findById($query->id());
    }
}
