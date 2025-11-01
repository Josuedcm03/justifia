<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Commands\CrearAsignaturaCommand;
use App\Domain\Catalogo\Entities\Asignatura;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;

final class CrearAsignaturaHandler
{
    public function __construct(private readonly AsignaturaRepository $asignaturas)
    {
    }

    public function handle(CrearAsignaturaCommand $command): Asignatura
    {
        $asignatura = Asignatura::crear($command->nombre(), $command->facultadId());

        return $this->asignaturas->create($asignatura);
    }
}
