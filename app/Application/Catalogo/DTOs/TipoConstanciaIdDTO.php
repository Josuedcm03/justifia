<?php

namespace App\Application\Catalogo\DTOs;

final class TipoConstanciaIdDTO
{
    public function __construct(private readonly int $id)
    {
    }

    public function id(): int
    {
        return $this->id;
    }
}
