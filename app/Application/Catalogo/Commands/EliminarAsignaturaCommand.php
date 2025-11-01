<?php

namespace App\Application\Catalogo\Commands;

use App\Application\Catalogo\DTOs\AsignaturaIdDTO;

final class EliminarAsignaturaCommand
{
    public function __construct(private readonly AsignaturaIdDTO $payload)
    {
    }

    public function id(): int
    {
        return $this->payload->id();
    }
}
