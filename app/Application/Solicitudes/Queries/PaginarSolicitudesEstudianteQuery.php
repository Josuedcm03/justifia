<?php

namespace App\Application\Solicitudes\Queries;

use App\Application\Solicitudes\DTOs\PaginarSolicitudesEstudianteDTO;
use App\Domain\Shared\Enums\EstadoSolicitud;

final class PaginarSolicitudesEstudianteQuery
{
    public function __construct(private readonly PaginarSolicitudesEstudianteDTO $payload)
    {
    }

    public function estudianteId(): int
    {
        return $this->payload->estudianteId();
    }

    public function estado(): EstadoSolicitud
    {
        return $this->payload->estado();
    }

    public function perPage(): int
    {
        return $this->payload->perPage();
    }
}
