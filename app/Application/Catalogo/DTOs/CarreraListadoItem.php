<?php

namespace App\Application\Catalogo\DTOs;

use App\Domain\Catalogo\Entities\Carrera;

final class CarreraListadoItem
{
    public function __construct(
        private readonly Carrera $carrera,
        private readonly ?string $facultadNombre,
    ) {
    }

    public function id(): ?int
    {
        return $this->carrera->id()?->value();
    }

    public function nombre(): string
    {
        return $this->carrera->nombre()->value();
    }

    public function facultadNombre(): ?string
    {
        return $this->facultadNombre;
    }

    public function carrera(): Carrera
    {
        return $this->carrera;
    }
}
