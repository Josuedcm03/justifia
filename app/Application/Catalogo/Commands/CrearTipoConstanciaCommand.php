<?php

namespace App\Application\Catalogo\Commands;

use App\Application\Catalogo\DTOs\CrearTipoConstanciaDTO;

final class CrearTipoConstanciaCommand
{
    public function __construct(private readonly CrearTipoConstanciaDTO $payload)
    {
    }

    public function nombre(): string
    {
        return $this->payload->nombre();
    }
}
