<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Commands\CrearTipoConstanciaCommand;
use App\Domain\Catalogo\Entities\TipoConstancia;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;

final class CrearTipoConstanciaHandler
{
    public function __construct(private readonly TipoConstanciaRepository $tipos)
    {
    }

    public function handle(CrearTipoConstanciaCommand $command): TipoConstancia
    {
        $tipo = TipoConstancia::crear($command->nombre());

        return $this->tipos->create($tipo);
    }
}
