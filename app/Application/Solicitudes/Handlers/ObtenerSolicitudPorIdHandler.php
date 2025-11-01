<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Solicitudes\Queries\ObtenerSolicitudPorIdQuery;
use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Solicitud\Repositories\SolicitudRepository;

final class ObtenerSolicitudPorIdHandler
{
    public function __construct(private readonly SolicitudRepository $solicitudes)
    {
    }

    public function handle(ObtenerSolicitudPorIdQuery $query): Solicitud
    {
        return $this->solicitudes->findById($query->solicitudId());
    }
}
