<?php

namespace App\Application\Solicitudes\Events;

use App\Domain\Solicitud\Entities\Solicitud;

final class SolicitudEstadoActualizado
{
    public function __construct(private readonly Solicitud $solicitud)
    {
    }

    public function solicitud(): Solicitud
    {
        return $this->solicitud;
    }
}
