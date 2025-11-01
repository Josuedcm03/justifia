<?php

namespace App\Application\Catalogo\DTOs;

final class PaginarTipoConstanciasDTO
{
    public function __construct(private readonly int $perPage)
    {
    }

    public function perPage(): int
    {
        return $this->perPage;
    }
}
