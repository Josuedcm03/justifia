<?php

namespace App\Application\Solicitudes\DTOs;

final class SolicitudIdDTO
{
    public function __construct(private readonly int $solicitudId)
    {
    }

    public function solicitudId(): int
    {
        return $this->solicitudId;
    }
}
