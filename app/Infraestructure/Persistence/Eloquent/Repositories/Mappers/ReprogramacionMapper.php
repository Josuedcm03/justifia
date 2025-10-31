<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Domain\Reprogramacion\Entities\Reprogramacion as ReprogramacionEntity;
use App\Domain\Shared\Contracts\Entity;
use App\Enums\EstadoAsistencia;
use App\Models\ModuloDocente\Reprogramacion as ReprogramacionModel;
use DateTimeImmutable;
use Illuminate\Database\Eloquent\Model;

class ReprogramacionMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return ReprogramacionModel::class;
    }

    protected function entityClass(): string
    {
        return ReprogramacionEntity::class;
    }

    protected function mapToEntity(Model $model): Entity
    {
        /** @var ReprogramacionModel $model */
        $fecha = $model->fecha instanceof \DateTimeInterface
            ? DateTimeImmutable::createFromInterface($model->fecha)
            : new DateTimeImmutable((string) $model->fecha);

        $asistencia = $model->asistencia instanceof EstadoAsistencia
            ? $model->asistencia
            : EstadoAsistencia::from($model->asistencia);

        return ReprogramacionEntity::reconstruir(
            (int) $model->id,
            $fecha,
            $model->hora,
            $asistencia,
            $model->observaciones,
            (int) $model->solicitud_id
        );
    }

    protected function mapToModel(Entity $entity): Model
    {
        /** @var ReprogramacionEntity $entity */
        $modelClass = $this->modelClass();

        /** @var ReprogramacionModel $model */
        $model = $entity->id() !== null
            ? $modelClass::findOrFail($entity->id()->value())
            : new $modelClass();

        $model->fill([
            'fecha' => $entity->fecha()->format('Y-m-d'),
            'hora' => $entity->hora()->value(),
            'asistencia' => $entity->asistencia(),
            'observaciones' => $entity->observaciones()?->value(),
            'solicitud_id' => $entity->solicitudId()->value(),
        ]);

        return $model;
    }
}
