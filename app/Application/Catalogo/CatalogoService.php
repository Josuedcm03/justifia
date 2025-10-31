<?php

namespace App\Application\Catalogo;

use App\Domain\Catalogo\Repositories\AsignaturaRepository;
use App\Domain\Catalogo\Repositories\FacultadRepository;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;
use App\Domain\Docente\Repositories\DocenteRepository;
use Illuminate\Support\Collection;

class CatalogoService
{
    public function __construct(
        private readonly DocenteRepository $docentes,
        private readonly FacultadRepository $facultades,
        private readonly TipoConstanciaRepository $tiposConstancia,
        private readonly AsignaturaRepository $asignaturas,
    ) {
    }

    public function docentes(): Collection
    {
        return $this->docentes->allWithUsuario();
    }

    public function facultades(): Collection
    {
        return $this->facultades->allOrdered();
    }

    public function tiposConstancia(): Collection
    {
        return $this->tiposConstancia->all();
    }

    public function asignaturasPorFacultad(int $facultadId): Collection
    {
        return $this->asignaturas->listByFacultad($facultadId);
    }

    public function buscarDocentes(string $nombre, int $limit = 10): Collection
    {
        return $this->docentes->searchByNombre($nombre, $limit);
    }

    public function buscarAsignaturas(string $termino = '', ?int $facultadId = null, int $limit = 10): Collection
    {
        return $this->asignaturas->search($termino, $facultadId, $limit);
    }
}