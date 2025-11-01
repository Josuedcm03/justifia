<?php

namespace App\Application\Apelaciones\Handlers;

use App\Application\Apelaciones\Queries\ObtenerUltimaApelacionRechazadaQuery;
use App\Domain\Apelaciones\Entities\Apelacion;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;

final class ObtenerUltimaApelacionRechazadaHandler
{
    public function __construct(private readonly ApelacionRepository $apelaciones)
    {
    }

    public function handle(ObtenerUltimaApelacionRechazadaQuery $query): ?Apelacion
    {
        return $this->apelaciones->obtenerUltimaRechazada($query->solicitudId());
    }
}
