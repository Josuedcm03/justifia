<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Reprogramacion\Entities\Reprogramacion;
use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;

class EloquentReprogramacionRepository implements ReprogramacionRepository
{
    public function __construct(
        private readonly ReprogramacionMapper $mapper,
    ) {
    }

    public function create(array $data): Reprogramacion
    {
        return $this->mapper->toEntity(Reprogramacion::create($data));
    }

    public function update(Reprogramacion $reprogramacion, array $data): Reprogramacion
    {
        $model = $this->mapper->toModel($reprogramacion);
        $model->update($data);

        return $this->mapper->toEntity($model->refresh());
    }
}