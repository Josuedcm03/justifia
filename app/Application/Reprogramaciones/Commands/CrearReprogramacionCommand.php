<?php

namespace App\Application\Reprogramaciones\Commands;

use App\Application\Reprogramaciones\DTOs\CrearReprogramacionDTO;

final class CrearReprogramacionCommand
{
    public function __construct(private readonly CrearReprogramacionDTO $payload)
    {
    }

    public function solicitudId(): int
    {
        return $this->payload->solicitudId();
    }

    public function fecha(): string
    {
        return $this->payload->fecha();
    }

    public function hora(): string
    {
        return $this->payload->hora();
    }

    public function observaciones(): ?string
    {
        return $this->payload->observaciones();
    }
}
