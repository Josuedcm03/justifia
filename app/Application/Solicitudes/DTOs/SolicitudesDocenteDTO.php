<?php

namespace App\Application\Solicitudes\DTOs;

final class SolicitudesDocenteDTO
{
    public function __construct(private readonly int $docenteId)
    {
    }

    public function docenteId(): int
    {
        return $this->docenteId;
    }
}
