<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Queries\BuscarAsignaturasQuery;
use App\Application\Catalogo\Queries\BuscarDocentesQuery;
use App\Application\Catalogo\Queries\ListarAsignaturasPorFacultadQuery;
use App\Application\Catalogo\Queries\ListarDocentesQuery;
use App\Application\Catalogo\Queries\ListarFacultadesQuery;
use App\Application\Catalogo\Queries\ListarTiposConstanciaQuery;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;
use App\Domain\Catalogo\Repositories\FacultadRepository;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;
use App\Domain\Docente\Repositories\DocenteRepository;

class CatalogoService
{
    public function __construct(
        private readonly DocenteRepository $docentes,
        private readonly FacultadRepository $facultades,
        private readonly TipoConstanciaRepository $tiposConstancia,
        private readonly AsignaturaRepository $asignaturas,
    ) {
    }

    /** @return iterable<\App\Domain\Docente\Entities\Docente> */
    public function docentes(ListarDocentesQuery $query): iterable
    {
        return $this->docentes->allWithUsuario();
    }

    /** @return iterable<\App\Domain\Catalogo\Entities\Facultad> */
    public function facultades(ListarFacultadesQuery $query): iterable
    {
        return $this->facultades->allOrdered();
    }

    /** @return iterable<\App\Domain\Catalogo\Entities\TipoConstancia> */
    public function tiposConstancia(ListarTiposConstanciaQuery $query): iterable
    {
        return $this->tiposConstancia->all();
    }

    /** @return iterable<\App\Domain\Catalogo\Entities\Asignatura> */
    public function asignaturasPorFacultad(ListarAsignaturasPorFacultadQuery $query): iterable
    {
        return $this->asignaturas->listByFacultad($query->facultadId());
    }

    /** @return iterable<\App\Domain\Docente\Entities\Docente> */
    public function buscarDocentes(BuscarDocentesQuery $query): iterable
    {
        return $this->docentes->searchByNombre($query->termino(), $query->limit());
    }

    /** @return iterable<\App\Domain\Catalogo\Entities\Asignatura> */
    public function buscarAsignaturas(BuscarAsignaturasQuery $query): iterable
    {
        return $this->asignaturas->search($query->termino(), $query->facultadId(), $query->limit());
    }
}