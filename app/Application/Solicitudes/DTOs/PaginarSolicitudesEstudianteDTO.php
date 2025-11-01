<?php

namespace App\Application\Solicitudes\DTOs;

use App\Domain\Shared\Enums\EstadoSolicitud;

final class PaginarSolicitudesEstudianteDTO
{
    public function __construct(
        private readonly int $estudianteId,
        private readonly EstadoSolicitud $estado,
        private readonly int $perPage
    ) {
    }

    public function estudianteId(): int
    {
        return $this->estudianteId;
    }

    public function estado(): EstadoSolicitud
    {
        return $this->estado;
    }

    public function perPage(): int
    {
        return $this->perPage;
    }
}
