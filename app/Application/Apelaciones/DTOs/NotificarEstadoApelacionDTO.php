<?php

namespace App\Application\Apelaciones\DTOs;

use App\Domain\Apelaciones\Entities\Apelacion;

final class NotificarEstadoApelacionDTO
{
    public function __construct(
        private readonly bool $aprobada,
        private readonly string $email,
        private readonly string $nombre,
        private readonly Apelacion $apelacion,
    ) {
    }

    public function aprobada(): bool
    {
        return $this->aprobada;
    }

    public function email(): string
    {
        return $this->email;
    }

    public function nombre(): string
    {
        return $this->nombre;
    }

    public function apelacion(): Apelacion
    {
        return $this->apelacion;
    }
}
