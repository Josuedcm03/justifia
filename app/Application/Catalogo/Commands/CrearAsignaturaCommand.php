<?php

namespace App\Application\Catalogo\Commands;

use App\Application\Catalogo\DTOs\CrearAsignaturaDTO;

final class CrearAsignaturaCommand
{
    public function __construct(private readonly CrearAsignaturaDTO $payload)
    {
    }

    public function nombre(): string
    {
        return $this->payload->nombre();
    }

    public function facultadId(): int
    {
        return $this->payload->facultadId();
    }
}
