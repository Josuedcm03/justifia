<?php

namespace App\Domain\Catalogo\Repositories;

use App\Domain\Catalogo\Entities\Carrera;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface CarreraRepository
{
    public function paginate(int $perPage = 10): LengthAwarePaginator;

    public function findById(int $id): Carrera;

    public function create(Carrera $carrera): Carrera;

    public function update(Carrera $carrera): Carrera;

    public function delete(Carrera $carrera): void;
}
