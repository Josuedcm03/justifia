<?php

namespace App\Application\Apelaciones\DTOs;

use App\Domain\Shared\Enums\EstadoApelacion;

final class PaginarApelacionesPorEstadoDTO
{
    public function __construct(
        private readonly EstadoApelacion $estado,
        private readonly int $perPage
    ) {
    }

    public function estado(): EstadoApelacion
    {
        return $this->estado;
    }

    public function perPage(): int
    {
        return $this->perPage;
    }
}
