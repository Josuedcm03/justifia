<?php

namespace App\Application\Catalogo\DTOs;

use App\Domain\Catalogo\Entities\Asignatura;

final class AsignaturaListadoItem
{
    public function __construct(
        private readonly Asignatura $asignatura,
        private readonly ?string $facultadNombre,
    ) {
    }

    public function id(): ?int
    {
        return $this->asignatura->id()?->value();
    }

    public function nombre(): string
    {
        return $this->asignatura->nombre()->value();
    }

    public function facultadNombre(): ?string
    {
        return $this->facultadNombre;
    }

    public function asignatura(): Asignatura
    {
        return $this->asignatura;
    }
}
