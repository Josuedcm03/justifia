<?php

namespace App\Application\Apelaciones\DTOs;

final class ApelacionPorSolicitudDTO
{
    public function __construct(private readonly int $solicitudId)
    {
    }

    public function solicitudId(): int
    {
        return $this->solicitudId;
    }
}
