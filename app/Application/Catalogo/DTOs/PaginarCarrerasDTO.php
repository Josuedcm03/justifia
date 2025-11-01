<?php

namespace App\Application\Catalogo\DTOs;

final class PaginarCarrerasDTO
{
    public function __construct(private readonly int $perPage)
    {
    }

    public function perPage(): int
    {
        return $this->perPage;
    }
}
