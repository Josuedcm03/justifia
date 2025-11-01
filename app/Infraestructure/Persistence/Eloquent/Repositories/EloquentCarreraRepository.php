<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Entities\Carrera as CarreraEntity;
use App\Domain\Catalogo\Repositories\CarreraRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\CarreraMapper;
use App\Models\ModuloSecretaria\Carrera as CarreraModel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class EloquentCarreraRepository implements CarreraRepository
{
    public function __construct(private readonly CarreraMapper $mapper)
    {
    }

    public function paginate(int $perPage = 10): LengthAwarePaginator
    {
        $paginator = CarreraModel::with('facultad')
            ->orderBy('nombre')
            ->paginate($perPage);

        $paginator->setCollection(
            $paginator->getCollection()->map(
                fn(CarreraModel $carrera) => $this->mapper->toEntity($carrera)
            )
        );

        return $paginator;
    }

    public function findById(int $id): CarreraEntity
    {
        $model = CarreraModel::findOrFail($id);

        return $this->mapper->toEntity($model);
    }

    public function create(CarreraEntity $carrera): CarreraEntity
    {
        $model = $this->mapper->toModel($carrera);
        $model->save();

        return $this->mapper->toEntity($model->fresh());
    }

    public function update(CarreraEntity $carrera): CarreraEntity
    {
        $model = $this->mapper->toModel($carrera);
        $model->save();

        return $this->mapper->toEntity($model->fresh());
    }

    public function delete(CarreraEntity $carrera): void
    {
        $this->mapper->toModel($carrera)->delete();
    }
}
