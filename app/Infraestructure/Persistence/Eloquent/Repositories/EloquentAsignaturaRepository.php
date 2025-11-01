<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Entities\Asignatura as AsignaturaEntity;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\AsignaturaMapper;
use App\Models\ModuloSecretaria\Asignatura as AsignaturaModel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class EloquentAsignaturaRepository implements AsignaturaRepository
{
    public function __construct(
        private readonly AsignaturaMapper $mapper,
    ) {
    }

    public function listByFacultad(int $facultadId): iterable
    {
        return AsignaturaModel::where('facultad_id', $facultadId)
            ->orderBy('nombre')
            ->get(['id', 'nombre'])
            ->map(fn(AsignaturaModel $asignatura) => $this->mapper->toEntity($asignatura));
    }

    public function search(string $termino = '', ?int $facultadId = null, int $limit = 10): iterable
    {
        return AsignaturaModel::query()
            ->when($facultadId, fn($q) => $q->where('facultad_id', $facultadId))
            ->when($termino !== '', fn($q) => $q->where('nombre', 'like', "%{$termino}%"))
            ->orderBy('nombre')
            ->limit($limit)
            ->get(['id', 'nombre'])
            ->map(fn(AsignaturaModel $asignatura) => $this->mapper->toEntity($asignatura));
    }

    public function paginate(string $termino = '', int $perPage = 15): LengthAwarePaginator
    {
        $paginator = AsignaturaModel::with('facultad')
            ->when(
                $termino !== '',
                fn($query) => $query->where('nombre', 'like', "%{$termino}%")
            )
            ->orderBy('nombre')
            ->paginate($perPage);

        $paginator->setCollection(
            $paginator->getCollection()->map(
                fn(AsignaturaModel $asignatura) => $this->mapper->toEntity($asignatura)
            )
        );

        return $paginator;
    }

    public function findById(int $id): AsignaturaEntity
    {
        $model = AsignaturaModel::findOrFail($id);

        return $this->mapper->toEntity($model);
    }

    public function create(AsignaturaEntity $asignatura): AsignaturaEntity
    {
        $model = $this->mapper->toModel($asignatura);
        $model->save();

        return $this->mapper->toEntity($model->fresh());
    }

    public function update(AsignaturaEntity $asignatura): AsignaturaEntity
    {
        $model = $this->mapper->toModel($asignatura);
        $model->save();

        return $this->mapper->toEntity($model->fresh());
    }

    public function delete(AsignaturaEntity $asignatura): void
    {
        $this->mapper->toModel($asignatura)->delete();
    }
}