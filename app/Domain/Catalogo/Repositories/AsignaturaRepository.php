<?php

namespace App\Domain\Catalogo\Repositories;

use App\Domain\Catalogo\Entities\Asignatura;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface AsignaturaRepository
{
    /** @return iterable<Asignatura> */
    public function listByFacultad(int $facultadId): iterable;

    /** @return iterable<Asignatura> */
    public function search(string $termino = '', ?int $facultadId = null, int $limit = 10): iterable;

    public function paginate(string $termino = '', int $perPage = 15): LengthAwarePaginator;

    public function findById(int $id): Asignatura;

    public function create(Asignatura $asignatura): Asignatura;

    public function update(Asignatura $asignatura): Asignatura;

    public function delete(Asignatura $asignatura): void;
}