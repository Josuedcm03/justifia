<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Commands\ActualizarAsignaturaCommand;
use App\Domain\Catalogo\Entities\Asignatura;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;

final class ActualizarAsignaturaHandler
{
    public function __construct(private readonly AsignaturaRepository $asignaturas)
    {
    }

    public function handle(ActualizarAsignaturaCommand $command): Asignatura
    {
        $asignatura = $this->asignaturas->findById($command->id());
        $asignatura->renombrar($command->nombre());
        $asignatura->cambiarFacultad($command->facultadId());

        return $this->asignaturas->update($asignatura);
    }
}
