<?php

namespace App\Application\Apelaciones\Commands;

use App\Application\Apelaciones\DTOs\NotificarEstadoApelacionDTO;
use App\Domain\Apelaciones\Entities\Apelacion;

final class NotificarEstadoApelacionCommand
{
    public function __construct(private readonly NotificarEstadoApelacionDTO $payload)
    {
    }

    public function aprobada(): bool
    {
        return $this->payload->aprobada();
    }

    public function email(): string
    {
        return $this->payload->email();
    }

    public function nombre(): string
    {
        return $this->payload->nombre();
    }

    public function apelacion(): Apelacion
    {
        return $this->payload->apelacion();
    }
}
