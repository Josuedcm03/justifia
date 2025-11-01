<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Queries\ListarTiposConstanciaQuery;
use App\Domain\Catalogo\Entities\TipoConstancia;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;

final class ListarTiposConstanciaHandler
{
    public function __construct(private readonly TipoConstanciaRepository $tiposConstancia)
    {
    }

    /** @return iterable<TipoConstancia> */
    public function handle(ListarTiposConstanciaQuery $query): iterable
    {
        return $this->tiposConstancia->all();
    }
}
