<?php

namespace App\Application\Catalogo;

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
    public function docentes(): iterable
    {
        return $this->docentes->allWithUsuario();
    }

    /** @return iterable<\App\Domain\Catalogo\Entities\Facultad> */
    public function facultades(): iterable
    {
        return $this->facultades->allOrdered();
    }

    /** @return iterable<\App\Domain\Catalogo\Entities\TipoConstancia> */
    public function tiposConstancia(): iterable
    {
        return $this->tiposConstancia->all();
    }

    /** @return iterable<\App\Domain\Catalogo\Entities\Asignatura> */
    public function asignaturasPorFacultad(int $facultadId): iterable
    {
        return $this->asignaturas->listByFacultad($facultadId);
    }

    /** @return iterable<\App\Domain\Docente\Entities\Docente> */
    public function buscarDocentes(string $nombre, int $limit = 10): iterable
    {
        return $this->docentes->searchByNombre($nombre, $limit);
    }

    /** @return iterable<\App\Domain\Catalogo\Entities\Asignatura> */
    public function buscarAsignaturas(string $termino = '', ?int $facultadId = null, int $limit = 10): iterable
    {
        return $this->asignaturas->search($termino, $facultadId, $limit);
    }
}