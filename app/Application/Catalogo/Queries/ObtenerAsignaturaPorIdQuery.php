<?php

namespace App\Application\Catalogo\Queries;

use App\Application\Catalogo\DTOs\AsignaturaIdDTO;

final class ObtenerAsignaturaPorIdQuery
{
    public function __construct(private readonly AsignaturaIdDTO $payload)
    {
    }

    public function id(): int
    {
        return $this->payload->id();
    }
}
