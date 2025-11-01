<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Commands\CrearCarreraCommand;
use App\Domain\Catalogo\Entities\Carrera;
use App\Domain\Catalogo\Repositories\CarreraRepository;

final class CrearCarreraHandler
{
    public function __construct(private readonly CarreraRepository $carreras)
    {
    }

    public function handle(CrearCarreraCommand $command): Carrera
    {
        $carrera = Carrera::crear($command->nombre(), $command->facultadId());

        return $this->carreras->create($carrera);
    }
}
