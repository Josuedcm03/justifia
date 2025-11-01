<?php

namespace App\Application\Catalogo\Commands;

use App\Application\Catalogo\DTOs\TipoConstanciaIdDTO;

final class EliminarTipoConstanciaCommand
{
    public function __construct(private readonly TipoConstanciaIdDTO $payload)
    {
    }

    public function id(): int
    {
        return $this->payload->id();
    }
}
