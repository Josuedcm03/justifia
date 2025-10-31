<?php

namespace App\Domain\Catalogo\Repositories;

use Illuminate\Support\Collection;

interface AsignaturaRepository
{
    public function listByFacultad(int $facultadId): Collection;

    public function search(string $termino = '', ?int $facultadId = null, int $limit = 10): Collection;
}