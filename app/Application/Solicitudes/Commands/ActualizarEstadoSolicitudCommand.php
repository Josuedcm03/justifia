<?php

namespace App\Application\Solicitudes\Commands;

use App\Application\Solicitudes\DTOs\ActualizarEstadoSolicitudDTO;
use App\Domain\Shared\Enums\EstadoSolicitud;

final class ActualizarEstadoSolicitudCommand
{
    public function __construct(private readonly ActualizarEstadoSolicitudDTO $payload)
    {
    }

    public function solicitudId(): int
    {
        return $this->payload->solicitudId();
    }

    public function estado(): EstadoSolicitud
    {
        return $this->payload->estado();
    }

    public function respuesta(): ?string
    {
        return $this->payload->respuesta();
    }

    public function version(): int
    {
        return $this->payload->version();
    }
}
