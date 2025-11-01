<?php

namespace App\Application\Catalogo\Queries;

use App\Application\Catalogo\DTOs\PaginarTipoConstanciasDTO;

final class PaginarTipoConstanciasQuery
{
    public function __construct(private readonly PaginarTipoConstanciasDTO $payload)
    {
    }

    public function perPage(): int
    {
        return $this->payload->perPage();
    }
}
