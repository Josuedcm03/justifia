<?php

namespace App\Domain\Catalogo\Repositories;

use App\Domain\Catalogo\Entities\Asignatura;

interface AsignaturaRepository
{
    /** @return iterable<Asignatura> */
    public function listByFacultad(int $facultadId): iterable;

    /** @return iterable<Asignatura> */
    public function search(string $termino = '', ?int $facultadId = null, int $limit = 10): iterable;
}