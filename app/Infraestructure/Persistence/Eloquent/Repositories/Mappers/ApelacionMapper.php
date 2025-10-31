<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Domain\Apelaciones\Entities\Apelacion as ApelacionEntity;
use App\Domain\Shared\Contracts\Entity;
use App\Domain\Shared\Enums\EstadoApelacion;
use App\Models\ModuloEstudiante\Apelacion as ApelacionModel;
use Illuminate\Database\Eloquent\Model;

class ApelacionMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return ApelacionModel::class;
    }

    protected function entityClass(): string
    {
        return ApelacionEntity::class;
    }

    protected function mapToEntity(Model $model): Entity
    {
        /** @var ApelacionModel $model */
        $estado = $model->estado instanceof EstadoApelacion
            ? $model->estado
            : EstadoApelacion::from($model->estado);

        return ApelacionEntity::reconstruir(
            (int) $model->id,
            $model->observacion,
            $model->respuesta,
            $estado,
            (int) $model->solicitud_id,
            $model->apelacion_id !== null ? (int) $model->apelacion_id : null
        );
    }

    protected function mapToModel(Entity $entity): Model
    {
        /** @var ApelacionEntity $entity */
        $modelClass = $this->modelClass();

        /** @var ApelacionModel $model */
        $model = $entity->id() !== null
            ? $modelClass::findOrFail($entity->id()->value())
            : new $modelClass();

        $model->fill([
            'observacion' => $entity->observacion()->value(),
            'respuesta' => $entity->respuesta()?->value(),
            'estado' => $entity->estado(),
            'solicitud_id' => $entity->solicitudId()->value(),
            'apelacion_id' => $entity->apelacionPadreId()?->value(),
        ]);

        return $model;
    }
}
