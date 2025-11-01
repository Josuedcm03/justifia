<?php

namespace App\Application\Catalogo\DTOs;

final class CrearAsignaturaDTO
{
    public function __construct(
        private readonly string $nombre,
        private readonly int $facultadId,
    ) {
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
