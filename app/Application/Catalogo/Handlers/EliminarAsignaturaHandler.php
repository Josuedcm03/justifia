<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Commands\EliminarAsignaturaCommand;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;

final class EliminarAsignaturaHandler
{
    public function __construct(private readonly AsignaturaRepository $asignaturas)
    {
    }

    public function handle(EliminarAsignaturaCommand $command): void
    {
        $asignatura = $this->asignaturas->findById($command->id());

        $this->asignaturas->delete($asignatura);
    }
}
