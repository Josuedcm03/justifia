<?php

namespace App\Application\Apelaciones\Queries;

use App\Application\Apelaciones\DTOs\ApelacionPorSolicitudDTO;

final class ObtenerUltimaApelacionRechazadaQuery
{
    public function __construct(private readonly ApelacionPorSolicitudDTO $payload)
    {
    }

    public function solicitudId(): int
    {
        return $this->payload->solicitudId();
    }
}
