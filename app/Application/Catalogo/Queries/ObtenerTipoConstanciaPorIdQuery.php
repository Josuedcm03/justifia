<?php

namespace App\Application\Catalogo\Queries;

use App\Application\Catalogo\DTOs\TipoConstanciaIdDTO;

final class ObtenerTipoConstanciaPorIdQuery
{
    public function __construct(private readonly TipoConstanciaIdDTO $payload)
    {
    }

    public function id(): int
    {
        return $this->payload->id();
    }
}
