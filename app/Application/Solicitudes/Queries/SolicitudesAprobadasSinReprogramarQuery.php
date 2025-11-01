<?php

namespace App\Application\Solicitudes\Queries;

use App\Application\Solicitudes\DTOs\SolicitudesDocenteDTO;

final class SolicitudesAprobadasSinReprogramarQuery
{
    public function __construct(private readonly SolicitudesDocenteDTO $payload)
    {
    }

    public function docenteId(): int
    {
        return $this->payload->docenteId();
    }
}
