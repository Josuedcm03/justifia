<?php

namespace App\Application\Catalogo\Commands;

use App\Application\Catalogo\DTOs\ActualizarAsignaturaDTO;

final class ActualizarAsignaturaCommand
{
    public function __construct(private readonly ActualizarAsignaturaDTO $payload)
    {
    }

    public function id(): int
    {
        return $this->payload->id();
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
