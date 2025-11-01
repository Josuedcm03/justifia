<?php

namespace App\Application\Seguridad\Commands;

use App\Application\Seguridad\DTOs\RegistrarEstudianteDTO;

final class RegistrarEstudianteCommand
{
    public function __construct(private readonly RegistrarEstudianteDTO $payload)
    {
    }

    public function payload(): RegistrarEstudianteDTO
    {
        return $this->payload;
    }
}
