<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Domain\Docente\Entities\Docente as DocenteEntity;
use App\Domain\Shared\Contracts\Entity;
use App\Models\ModuloSecretaria\Docente as DocenteModel;
use Illuminate\Database\Eloquent\Model;

class DocenteMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return DocenteModel::class;
    }

    protected function entityClass(): string
    {
        return DocenteEntity::class;
    }

    protected function mapToEntity(Model $model): Entity
    {
        /** @var DocenteModel $model */
        return DocenteEntity::reconstruir(
            (int) $model->id,
            $model->cif,
            (int) $model->usuario_id
        );
    }

    protected function mapToModel(Entity $entity): Model
    {
        /** @var DocenteEntity $entity */
        $modelClass = $this->modelClass();

        /** @var DocenteModel $model */
        $model = $entity->id() !== null
            ? $modelClass::findOrFail($entity->id()->value())
            : new $modelClass();

        $model->fill([
            'cif' => $entity->cif()->value(),
            'usuario_id' => $entity->usuarioId()->value(),
        ]);

        return $model;
    }
}
