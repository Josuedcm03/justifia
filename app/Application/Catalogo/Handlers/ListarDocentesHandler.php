<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Queries\ListarDocentesQuery;
use App\Domain\Docente\Entities\Docente;
use App\Domain\Docente\Repositories\DocenteRepository;

final class ListarDocentesHandler
{
    public function __construct(private readonly DocenteRepository $docentes)
    {
    }

    /** @return iterable<Docente> */
    public function handle(ListarDocentesQuery $query): iterable
    {
        return $this->docentes->allWithUsuario();
    }
}
