<?php

namespace App\Application\Apelaciones\Handlers;

use App\Application\Apelaciones\Queries\ObtenerUltimaApelacionDeSolicitudQuery;
use App\Domain\Apelaciones\Entities\Apelacion;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;

final class ObtenerUltimaApelacionDeSolicitudHandler
{
    public function __construct(private readonly ApelacionRepository $apelaciones)
    {
    }

    public function handle(ObtenerUltimaApelacionDeSolicitudQuery $query): ?Apelacion
    {
        return $this->apelaciones->obtenerUltimaPorSolicitud($query->solicitudId());
    }
}
