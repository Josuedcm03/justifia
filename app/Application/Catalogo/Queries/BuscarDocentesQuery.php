<?php

namespace App\Application\Catalogo\Queries;

use App\Application\Catalogo\DTOs\BuscarDocentesDTO;

final class BuscarDocentesQuery
{
    public function __construct(private readonly BuscarDocentesDTO $payload)
    {
    }

    public function termino(): string
    {
        return $this->payload->termino();
    }

    public function limit(): int
    {
        return $this->payload->limit();
    }
}
