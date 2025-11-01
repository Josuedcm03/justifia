<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Solicitudes\Queries\SolicitudesAprobadasSinReprogramarQuery;
use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Solicitud\Repositories\SolicitudRepository;

final class SolicitudesAprobadasSinReprogramarHandler
{
    public function __construct(private readonly SolicitudRepository $solicitudes)
    {
    }

    /** @return iterable<Solicitud> */
    public function handle(SolicitudesAprobadasSinReprogramarQuery $query): iterable
    {
        return $this->solicitudes->solicitudesAprobadasSinReprogramacion($query->docenteId());
    }
}
