<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Queries\ObtenerTipoConstanciaPorIdQuery;
use App\Domain\Catalogo\Entities\TipoConstancia;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;

final class ObtenerTipoConstanciaPorIdHandler
{
    public function __construct(private readonly TipoConstanciaRepository $tipos)
    {
    }

    public function handle(ObtenerTipoConstanciaPorIdQuery $query): TipoConstancia
    {
        return $this->tipos->findById($query->id());
    }
}
