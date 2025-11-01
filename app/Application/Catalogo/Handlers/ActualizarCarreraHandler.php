<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Commands\ActualizarCarreraCommand;
use App\Domain\Catalogo\Entities\Carrera;
use App\Domain\Catalogo\Repositories\CarreraRepository;

final class ActualizarCarreraHandler
{
    public function __construct(private readonly CarreraRepository $carreras)
    {
    }

    public function handle(ActualizarCarreraCommand $command): Carrera
    {
        $carrera = $this->carreras->findById($command->id());
        $carrera->renombrar($command->nombre());
        $carrera->cambiarFacultad($command->facultadId());

        return $this->carreras->update($carrera);
    }
}
