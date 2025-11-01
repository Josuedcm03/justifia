<?php

namespace App\Application\Apelaciones\DTOs;

final class CrearApelacionDTO
{
    public function __construct(
        private readonly string $observacion,
        private readonly int $solicitudId,
        private readonly ?int $apelacionPadreId
    ) {
    }

    public function observacion(): string
    {
        return $this->observacion;
    }

    public function solicitudId(): int
    {
        return $this->solicitudId;
    }

    public function apelacionPadreId(): ?int
    {
        return $this->apelacionPadreId;
    }
}
