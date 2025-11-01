<?php

namespace App\Application\Solicitudes\DTOs;

use App\Domain\Shared\Enums\EstadoSolicitud;

final class PaginarSolicitudesSecretariaDTO
{
    public function __construct(
        private readonly EstadoSolicitud $estado,
        private readonly bool $sinApelacionesPendientes,
        private readonly int $perPage
    ) {
    }

    public function estado(): EstadoSolicitud
    {
        return $this->estado;
    }

    public function sinApelacionesPendientes(): bool
    {
        return $this->sinApelacionesPendientes;
    }

    public function perPage(): int
    {
        return $this->perPage;
    }
}
