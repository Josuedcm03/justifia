<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Queries\BuscarDocentesQuery;
use App\Domain\Docente\Entities\Docente;
use App\Domain\Docente\Repositories\DocenteRepository;

final class BuscarDocentesHandler
{
    public function __construct(private readonly DocenteRepository $docentes)
    {
    }

    /** @return iterable<Docente> */
    public function handle(BuscarDocentesQuery $query): iterable
    {
        return $this->docentes->searchByNombre($query->termino(), $query->limit());
    }
}
