<?php

namespace App\Application\Catalogo\Queries;

use App\Application\Catalogo\DTOs\PaginarCarrerasDTO;

final class PaginarCarrerasQuery
{
    public function __construct(private readonly PaginarCarrerasDTO $payload)
    {
    }

    public function perPage(): int
    {
        return $this->payload->perPage();
    }
}
