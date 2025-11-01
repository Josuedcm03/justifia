<?php

namespace App\Application\Catalogo\Queries;

use App\Application\Catalogo\DTOs\BuscarAsignaturasDTO;

final class BuscarAsignaturasQuery
{
    public function __construct(private readonly BuscarAsignaturasDTO $payload)
    {
    }

    public function termino(): string
    {
        return $this->payload->termino();
    }

    public function facultadId(): ?int
    {
        return $this->payload->facultadId();
    }

    public function limit(): int
    {
        return $this->payload->limit();
    }
}
