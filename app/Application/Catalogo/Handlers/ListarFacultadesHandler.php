<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Queries\ListarFacultadesQuery;
use App\Domain\Catalogo\Entities\Facultad;
use App\Domain\Catalogo\Repositories\FacultadRepository;

final class ListarFacultadesHandler
{
    public function __construct(private readonly FacultadRepository $facultades)
    {
    }

    /** @return iterable<Facultad> */
    public function handle(ListarFacultadesQuery $query): iterable
    {
        return $this->facultades->allOrdered();
    }
}
