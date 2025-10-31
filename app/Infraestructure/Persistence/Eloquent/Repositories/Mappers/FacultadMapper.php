<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Domain\Catalogo\Entities\Facultad as FacultadEntity;
use App\Domain\Shared\Contracts\Entity;
use App\Models\ModuloSecretaria\Facultad as FacultadModel;
use Illuminate\Database\Eloquent\Model;

class FacultadMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return FacultadModel::class;
    }

    protected function entityClass(): string
    {
        return FacultadEntity::class;
    }

    protected function mapToEntity(Model $model): Entity
    {
        /** @var FacultadModel $model */
        return FacultadEntity::reconstruir(
            (int) $model->id,
            $model->nombre
        );
    }

    protected function mapToModel(Entity $entity): Model
    {
        /** @var FacultadEntity $entity */
        $modelClass = $this->modelClass();

        /** @var FacultadModel $model */
        $model = $entity->id() !== null
            ? $modelClass::findOrFail($entity->id()->value())
            : new $modelClass();

        $model->fill([
            'nombre' => $entity->nombre()->value(),
        ]);

        return $model;
    }
}
