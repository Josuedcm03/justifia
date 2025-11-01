<?php

namespace App\Application\Catalogo\Queries;

use App\Application\Catalogo\DTOs\PaginarAsignaturasDTO;

final class PaginarAsignaturasQuery
{
    public function __construct(private readonly PaginarAsignaturasDTO $payload)
    {
    }

    public function termino(): string
    {
        return $this->payload->termino();
    }

    public function perPage(): int
    {
        return $this->payload->perPage();
    }
}
