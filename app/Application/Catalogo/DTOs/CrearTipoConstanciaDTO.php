<?php

namespace App\Application\Catalogo\DTOs;

final class CrearTipoConstanciaDTO
{
    public function __construct(private readonly string $nombre)
    {
    }

    public function nombre(): string
    {
        return $this->nombre;
    }
}
