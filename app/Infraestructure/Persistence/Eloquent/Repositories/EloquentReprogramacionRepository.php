<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Reprogramacion\Entities\Reprogramacion as ReprogramacionEntity;
use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\ReprogramacionMapper;
use App\Models\ModuloDocente\Reprogramacion as ReprogramacionModel;

class EloquentReprogramacionRepository implements ReprogramacionRepository
{
    public function __construct(
        private readonly ReprogramacionMapper $mapper,
    ) {
    }

    public function create(ReprogramacionEntity $reprogramacion): ReprogramacionEntity
    {
        $model = $this->mapper->toModel($reprogramacion);
        $model->save();

        return $this->mapper->toEntity($model->fresh());
    }

    public function update(ReprogramacionEntity $reprogramacion): ReprogramacionEntity
    {
        $model = $this->mapper->toModel($reprogramacion);
        $model->save();

        return $this->mapper->toEntity($model->fresh());
    }

    public function findById(int $id): ReprogramacionEntity
    {
        $model = ReprogramacionModel::findOrFail($id);

        return $this->mapper->toEntity($model);
    }
}