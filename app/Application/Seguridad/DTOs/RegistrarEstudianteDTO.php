<?php

namespace App\Application\Seguridad\DTOs;

final class RegistrarEstudianteDTO
{
    public function __construct(
        private readonly string $nombre,
        private readonly string $correo,
        private readonly string $cif,
        private readonly int $carreraId,
        private readonly string $password,
    ) {
    }

    public function nombre(): string
    {
        return $this->nombre;
    }

    public function correo(): string
    {
        return $this->correo;
    }

    public function cif(): string
    {
        return $this->cif;
    }

    public function carreraId(): int
    {
        return $this->carreraId;
    }

    public function password(): string
    {
        return $this->password;
    }
}
