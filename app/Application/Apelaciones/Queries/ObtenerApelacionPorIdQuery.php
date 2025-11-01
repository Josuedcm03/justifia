<?php

namespace App\Application\Apelaciones\Queries;

use App\Application\Apelaciones\DTOs\ApelacionIdDTO;

final class ObtenerApelacionPorIdQuery
{
    public function __construct(private readonly ApelacionIdDTO $payload)
    {
    }

    public function apelacionId(): int
    {
        return $this->payload->apelacionId();
    }
}
