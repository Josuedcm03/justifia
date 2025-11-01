<?php

namespace App\Application\Reprogramaciones\Commands;

use App\Application\Reprogramaciones\DTOs\ActualizarReprogramacionDTO;
use App\Domain\Shared\Enums\EstadoAsistencia;

final class ActualizarReprogramacionCommand
{
    public function __construct(private readonly ActualizarReprogramacionDTO $payload)
    {
    }

    public function reprogramacionId(): int
    {
        return $this->payload->reprogramacionId();
    }

    public function fecha(): ?string
    {
        return $this->payload->fecha();
    }

    public function hora(): ?string
    {
        return $this->payload->hora();
    }

    public function observaciones(): ?string
    {
        return $this->payload->observaciones();
    }

    public function asistencia(): ?EstadoAsistencia
    {
        return $this->payload->asistencia();
    }
}
