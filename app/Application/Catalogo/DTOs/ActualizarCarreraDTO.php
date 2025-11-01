<?php

namespace App\Application\Catalogo\DTOs;

final class ActualizarCarreraDTO
{
    public function __construct(
        private readonly int $id,
        private readonly string $nombre,
        private readonly int $facultadId,
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

    public function facultadId(): int
    {
        return $this->facultadId;
    }
}
