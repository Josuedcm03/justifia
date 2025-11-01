<?php

namespace App\Application\Catalogo\DTOs;

final class PaginarAsignaturasDTO
{
    public function __construct(
        private readonly string $termino,
        private readonly int $perPage,
    ) {
    }

    public function termino(): string
    {
        return $this->termino;
    }

    public function perPage(): int
    {
        return $this->perPage;
    }
}
