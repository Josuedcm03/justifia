<?php

namespace App\Application\Apelaciones\Commands;

use App\Application\Apelaciones\DTOs\ActualizarApelacionDTO;
use App\Domain\Shared\Enums\EstadoApelacion;

final class ActualizarApelacionCommand
{
    public function __construct(private readonly ActualizarApelacionDTO $payload)
    {
    }

    public function apelacionId(): int
    {
        return $this->payload->apelacionId();
    }

    public function estado(): ?EstadoApelacion
    {
        return $this->payload->estado();
    }

    public function respuesta(): ?string
    {
        return $this->payload->respuesta();
    }

    public function observacion(): ?string
    {
        return $this->payload->observacion();
    }
}
