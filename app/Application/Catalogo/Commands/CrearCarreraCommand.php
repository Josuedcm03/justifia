<?php

namespace App\Application\Catalogo\Commands;

use App\Application\Catalogo\DTOs\CrearCarreraDTO;

final class CrearCarreraCommand
{
    public function __construct(private readonly CrearCarreraDTO $payload)
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
