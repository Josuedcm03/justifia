<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Solicitudes\Queries\ReprogramacionesPorDocenteQuery;
use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Solicitud\Repositories\SolicitudRepository;

final class ReprogramacionesPorDocenteHandler
{
    public function __construct(private readonly SolicitudRepository $solicitudes)
    {
    }

    /** @return iterable<Solicitud> */
    public function handle(ReprogramacionesPorDocenteQuery $query): iterable
    {
        return $this->solicitudes->reprogramacionesPorDocente($query->docenteId());
    }
}
