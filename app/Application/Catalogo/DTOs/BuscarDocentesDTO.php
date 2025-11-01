<?php

namespace App\Application\Catalogo\DTOs;

final class BuscarDocentesDTO
{
    public function __construct(
        private readonly string $termino,
        private readonly int $limit
    ) {
    }

    public function termino(): string
    {
        return $this->termino;
    }

    public function limit(): int
    {
        return $this->limit;
    }
}
