<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Commands\EliminarTipoConstanciaCommand;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;

final class EliminarTipoConstanciaHandler
{
    public function __construct(private readonly TipoConstanciaRepository $tipos)
    {
    }

    public function handle(EliminarTipoConstanciaCommand $command): void
    {
        $tipo = $this->tipos->findById($command->id());

        $this->tipos->delete($tipo);
    }
}
