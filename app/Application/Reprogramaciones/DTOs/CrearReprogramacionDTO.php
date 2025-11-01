<?php

namespace App\Application\Reprogramaciones\DTOs;

final class CrearReprogramacionDTO
{
    public function __construct(
        private readonly int $solicitudId,
        private readonly string $fecha,
        private readonly string $hora,
        private readonly ?string $observaciones
    ) {
    }

    public function solicitudId(): int
    {
        return $this->solicitudId;
    }

    public function fecha(): string
    {
        return $this->fecha;
    }

    public function hora(): string
    {
        return $this->hora;
    }

    public function observaciones(): ?string
    {
        return $this->observaciones;
    }
}
