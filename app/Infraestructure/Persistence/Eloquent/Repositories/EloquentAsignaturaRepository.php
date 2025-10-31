<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Repositories\AsignaturaRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\AsignaturaMapper;
use App\Models\ModuloSecretaria\Asignatura;
use Illuminate\Support\Collection;

class EloquentAsignaturaRepository implements AsignaturaRepository
{
    public function __construct(
        private readonly AsignaturaMapper $mapper,
    ) {
    }

    public function listByFacultad(int $facultadId): Collection
    {
        return Asignatura::where('facultad_id', $facultadId)
            ->orderBy('nombre')
            ->get(['id', 'nombre'])
            ->map(fn(Asignatura $asignatura) => $this->mapper->toEntity($asignatura));
    }

    public function search(string $termino = '', ?int $facultadId = null, int $limit = 10): Collection
    {
        return Asignatura::query()
            ->when($facultadId, fn($q) => $q->where('facultad_id', $facultadId))
            ->when($termino !== '', fn($q) => $q->where('nombre', 'like', "%{$termino}%"))
            ->orderBy('nombre')
            ->limit($limit)
            ->get(['id', 'nombre'])
            ->map(fn(Asignatura $asignatura) => $this->mapper->toEntity($asignatura));
    }
}