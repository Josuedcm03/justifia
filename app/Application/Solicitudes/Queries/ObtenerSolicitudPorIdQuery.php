<?php

namespace App\Application\Solicitudes\Queries;

use App\Application\Solicitudes\DTOs\SolicitudIdDTO;

final class ObtenerSolicitudPorIdQuery
{
    public function __construct(private readonly SolicitudIdDTO $payload)
    {
    }

    public function solicitudId(): int
    {
        return $this->payload->solicitudId();
    }
}
