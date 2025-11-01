<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Commands\EliminarCarreraCommand;
use App\Domain\Catalogo\Repositories\CarreraRepository;

final class EliminarCarreraHandler
{
    public function __construct(private readonly CarreraRepository $carreras)
    {
    }

    public function handle(EliminarCarreraCommand $command): void
    {
        $carrera = $this->carreras->findById($command->id());

        $this->carreras->delete($carrera);
    }
}
