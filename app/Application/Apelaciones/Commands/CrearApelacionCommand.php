<?php

namespace App\Application\Apelaciones\Commands;

use App\Application\Apelaciones\DTOs\CrearApelacionDTO;

final class CrearApelacionCommand
{
    public function __construct(private readonly CrearApelacionDTO $payload)
    {
    }

    public function observacion(): string
    {
        return $this->payload->observacion();
    }

    public function solicitudId(): int
    {
        return $this->payload->solicitudId();
    }

    public function apelacionPadreId(): ?int
    {
        return $this->payload->apelacionPadreId();
    }
}
