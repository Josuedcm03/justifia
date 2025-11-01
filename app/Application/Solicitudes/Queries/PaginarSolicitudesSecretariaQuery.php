<?php

namespace App\Application\Solicitudes\Queries;

use App\Application\Solicitudes\DTOs\PaginarSolicitudesSecretariaDTO;
use App\Domain\Shared\Enums\EstadoSolicitud;

final class PaginarSolicitudesSecretariaQuery
{
    public function __construct(private readonly PaginarSolicitudesSecretariaDTO $payload)
    {
    }

    public function estado(): EstadoSolicitud
    {
        return $this->payload->estado();
    }

    public function sinApelacionesPendientes(): bool
    {
        return $this->payload->sinApelacionesPendientes();
    }

    public function perPage(): int
    {
        return $this->payload->perPage();
    }
}
