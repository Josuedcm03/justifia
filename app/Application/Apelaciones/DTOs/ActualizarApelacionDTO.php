<?php

namespace App\Application\Apelaciones\DTOs;

use App\Domain\Shared\Enums\EstadoApelacion;

final class ActualizarApelacionDTO
{
    public function __construct(
        private readonly int $apelacionId,
        private readonly ?EstadoApelacion $estado,
        private readonly ?string $respuesta,
        private readonly ?string $observacion
    ) {
    }

    public function apelacionId(): int
    {
        return $this->apelacionId;
    }

    public function estado(): ?EstadoApelacion
    {
        return $this->estado;
    }

    public function respuesta(): ?string
    {
        return $this->respuesta;
    }

    public function observacion(): ?string
    {
        return $this->observacion;
    }
}
