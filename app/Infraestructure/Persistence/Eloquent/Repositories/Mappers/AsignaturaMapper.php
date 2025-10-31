<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Domain\Catalogo\Entities\Asignatura as AsignaturaEntity;
use App\Domain\Shared\Contracts\Entity;
use App\Models\ModuloSecretaria\Asignatura as AsignaturaModel;
use Illuminate\Database\Eloquent\Model;

class AsignaturaMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return AsignaturaModel::class;
    }

    protected function entityClass(): string
    {
        return AsignaturaEntity::class;
    }

    protected function mapToEntity(Model $model): Entity
    {
        /** @var AsignaturaModel $model */
        return AsignaturaEntity::reconstruir(
            (int) $model->id,
            $model->nombre,
            (int) $model->facultad_id
        );
    }

    protected function mapToModel(Entity $entity): Model
    {
        /** @var AsignaturaEntity $entity */
        $modelClass = $this->modelClass();

        /** @var AsignaturaModel $model */
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
