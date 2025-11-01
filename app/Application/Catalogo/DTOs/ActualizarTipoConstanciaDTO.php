<?php

namespace App\Application\Catalogo\DTOs;

final class ActualizarTipoConstanciaDTO
{
    public function __construct(
        private readonly int $id,
        private readonly string $nombre,
    ) {
    }

    public function id(): int
    {
        return $this->id;
    }

    public function nombre(): string
    {
        return $this->nombre;
    }
}
