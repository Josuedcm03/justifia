<?php

namespace App\Application\Catalogo\Commands;

use App\Application\Catalogo\DTOs\ActualizarTipoConstanciaDTO;

final class ActualizarTipoConstanciaCommand
{
    public function __construct(private readonly ActualizarTipoConstanciaDTO $payload)
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
}
