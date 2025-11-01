<?php

namespace App\Application\Reprogramaciones\DTOs;

use App\Domain\Shared\Enums\EstadoAsistencia;

final class ActualizarReprogramacionDTO
{
    public function __construct(
        private readonly int $reprogramacionId,
        private readonly ?string $fecha,
        private readonly ?string $hora,
        private readonly ?string $observaciones,
        private readonly ?EstadoAsistencia $asistencia
    ) {
    }

    public function reprogramacionId(): int
    {
        return $this->reprogramacionId;
    }

    public function fecha(): ?string
    {
        return $this->fecha;
    }

    public function hora(): ?string
    {
        return $this->hora;
    }

    public function observaciones(): ?string
    {
        return $this->observaciones;
    }

    public function asistencia(): ?EstadoAsistencia
    {
        return $this->asistencia;
    }
}
