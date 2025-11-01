<?php

namespace App\Application\Catalogo\Commands;

use App\Application\Catalogo\DTOs\CarreraIdDTO;

final class EliminarCarreraCommand
{
    public function __construct(private readonly CarreraIdDTO $payload)
    {
    }

    public function id(): int
    {
        return $this->payload->id();
    }
}
