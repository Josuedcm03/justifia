<?php

namespace App\Application\Catalogo\DTOs;

final class BuscarAsignaturasDTO
{
    public function __construct(
        private readonly string $termino,
        private readonly ?int $facultadId,
        private readonly int $limit
    ) {
    }

    public function termino(): string
    {
        return $this->termino;
    }

    public function facultadId(): ?int
    {
        return $this->facultadId;
    }

    public function limit(): int
    {
        return $this->limit;
    }
}
