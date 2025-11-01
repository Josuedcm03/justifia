<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Domain\Catalogo\Entities\Carrera as CarreraEntity;
use App\Domain\Shared\Contracts\Entity;
use App\Models\ModuloSecretaria\Carrera as CarreraModel;
use Illuminate\Database\Eloquent\Model;

class CarreraMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return CarreraModel::class;
    }

    protected function entityClass(): string
    {
        return CarreraEntity::class;
    }

    protected function mapToEntity(Model $model): Entity
    {
        /** @var CarreraModel $model */
        return CarreraEntity::reconstruir(
            (int) $model->id,
            $model->nombre,
            (int) $model->facultad_id
        );
    }

    protected function mapToModel(Entity $entity): Model
    {
        /** @var CarreraEntity $entity */
        $modelClass = $this->modelClass();

        /** @var CarreraModel $model */
        $model = $entity->id() !== null
            ? $modelClass::findOrFail($entity->id()->value())
            : new $modelClass();

        $model->fill([
            'nombre' => $entity->nombre()->value(),
            'facultad_id' => $entity->facultadId()->value(),
        ]);

        return $model;
    }
}
