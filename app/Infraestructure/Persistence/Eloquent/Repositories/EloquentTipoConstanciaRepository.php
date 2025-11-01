<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Entities\TipoConstancia as TipoConstanciaEntity;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\TipoConstanciaMapper;
use App\Models\ModuloSecretaria\TipoConstancia as TipoConstanciaModel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class EloquentTipoConstanciaRepository implements TipoConstanciaRepository
{
    public function __construct(
        private readonly TipoConstanciaMapper $mapper,
    ) {
    }

    public function all(): iterable
    {
        return TipoConstanciaModel::orderBy('nombre')
            ->get()
            ->map(fn(TipoConstanciaModel $tipo) => $this->mapper->toEntity($tipo));
    }

    public function paginate(int $perPage = 10): LengthAwarePaginator
    {
        $paginator = TipoConstanciaModel::orderBy('nombre')
            ->paginate($perPage);

        $paginator->setCollection(
            $paginator->getCollection()->map(
                fn(TipoConstanciaModel $tipo) => $this->mapper->toEntity($tipo)
            )
        );

        return $paginator;
    }

    public function findById(int $id): TipoConstanciaEntity
    {
        $model = TipoConstanciaModel::findOrFail($id);

        return $this->mapper->toEntity($model);
    }

    public function create(TipoConstanciaEntity $tipoConstancia): TipoConstanciaEntity
    {
        $model = $this->mapper->toModel($tipoConstancia);
        $model->save();

        return $this->mapper->toEntity($model->fresh());
    }

    public function update(TipoConstanciaEntity $tipoConstancia): TipoConstanciaEntity
    {
        $model = $this->mapper->toModel($tipoConstancia);
        $model->save();

        return $this->mapper->toEntity($model->fresh());
    }

    public function delete(TipoConstanciaEntity $tipoConstancia): void
    {
        $this->mapper->toModel($tipoConstancia)->delete();
    }
}