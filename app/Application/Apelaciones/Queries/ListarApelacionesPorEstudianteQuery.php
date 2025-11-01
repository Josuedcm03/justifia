<?php

namespace App\Application\Apelaciones\Queries;

use App\Application\Apelaciones\DTOs\ApelacionesPorEstudianteDTO;

final class ListarApelacionesPorEstudianteQuery
{
    public function __construct(private readonly ApelacionesPorEstudianteDTO $payload)
    {
    }

    public function estudianteId(): int
    {
        return $this->payload->estudianteId();
    }
}
