<?php

namespace App\Application\Catalogo\Queries;

use App\Application\Catalogo\DTOs\CarreraIdDTO;

final class ObtenerCarreraPorIdQuery
{
    public function __construct(private readonly CarreraIdDTO $payload)
    {
    }

    public function id(): int
    {
        return $this->payload->id();
    }
}
