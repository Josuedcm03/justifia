<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Repositories\AsignaturaRepository;
use App\Domain\Catalogo\Entities\Asignatura;
use Illuminate\Support\Collection;

class EloquentAsignaturaRepository implements AsignaturaRepository
{
    public function listByFacultad(int $facultadId): Collection
    {
        return Asignatura::where('facultad_id', $facultadId)
            ->orderBy('nombre')
            ->get(['id', 'nombre']);
    }

    public function search(string $termino = '', ?int $facultadId = null, int $limit = 10): Collection
    {
        return Asignatura::query()
            ->when($facultadId, fn($q) => $q->where('facultad_id', $facultadId))
            ->when($termino !== '', fn($q) => $q->where('nombre', 'like', "%{$termino}%"))
            ->orderBy('nombre')
            ->limit($limit)
            ->get(['id', 'nombre']);
    }
}