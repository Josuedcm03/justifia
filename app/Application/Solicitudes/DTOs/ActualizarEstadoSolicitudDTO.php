<?php

namespace App\Application\Solicitudes\DTOs;

use App\Domain\Shared\Enums\EstadoSolicitud;

final class ActualizarEstadoSolicitudDTO
{
    public function __construct(
        private readonly int $solicitudId,
        private readonly EstadoSolicitud $estado,
        private readonly ?string $respuesta,
        private readonly int $version
    ) {
    }

    public function solicitudId(): int
    {
        return $this->solicitudId;
    }

    public function estado(): EstadoSolicitud
    {
        return $this->estado;
    }

    public function respuesta(): ?string
    {
        return $this->respuesta;
    }

    public function version(): int
    {
        return $this->version;
    }
}
