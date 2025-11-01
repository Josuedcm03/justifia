<?php

namespace App\Application\Solicitudes\Commands;

use App\Application\Solicitudes\DTOs\SolicitudIdDTO;

final class EliminarSolicitudCommand
{
    public function __construct(private readonly SolicitudIdDTO $payload)
    {
    }

    public function solicitudId(): int
    {
        return $this->payload->solicitudId();
    }
}
