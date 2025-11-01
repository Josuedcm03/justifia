<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Commands\ActualizarTipoConstanciaCommand;
use App\Domain\Catalogo\Entities\TipoConstancia;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;

final class ActualizarTipoConstanciaHandler
{
    public function __construct(private readonly TipoConstanciaRepository $tipos)
    {
    }

    public function handle(ActualizarTipoConstanciaCommand $command): TipoConstancia
    {
        $tipo = $this->tipos->findById($command->id());
        $tipo->renombrar($command->nombre());

        return $this->tipos->update($tipo);
    }
}
