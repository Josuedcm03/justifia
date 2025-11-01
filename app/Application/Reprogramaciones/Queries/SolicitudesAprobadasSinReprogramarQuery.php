<?php

namespace App\Application\Reprogramaciones\Queries;

use App\Application\Reprogramaciones\DTOs\DocenteIdDTO;

final class SolicitudesAprobadasSinReprogramarQuery
{
    public function __construct(private readonly DocenteIdDTO $payload)
    {
    }

    public function docenteId(): int
    {
        return $this->payload->docenteId();
    }
}
