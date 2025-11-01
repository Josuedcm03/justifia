<?php

namespace App\Application\Apelaciones\Queries;

use App\Application\Apelaciones\DTOs\PaginarApelacionesPorEstadoDTO;
use App\Domain\Shared\Enums\EstadoApelacion;

final class PaginarApelacionesPorEstadoQuery
{
    public function __construct(private readonly PaginarApelacionesPorEstadoDTO $payload)
    {
    }

    public function estado(): EstadoApelacion
    {
        return $this->payload->estado();
    }

    public function perPage(): int
    {
        return $this->payload->perPage();
    }
}
