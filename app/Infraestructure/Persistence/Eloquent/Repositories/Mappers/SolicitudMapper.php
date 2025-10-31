<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Domain\Shared\Contracts\Entity;
use App\Domain\Shared\ValueObjects\ArchivoConstancia;
use App\Domain\Solicitud\Entities\Solicitud as SolicitudEntity;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Models\ModuloEstudiante\Solicitud as SolicitudModel;
use DateTimeImmutable;
use Illuminate\Database\Eloquent\Model;

class SolicitudMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return SolicitudModel::class;
    }

    protected function entityClass(): string
    {
        return SolicitudEntity::class;
    }

    protected function mapToEntity(Model $model): Entity
    {
        /** @var SolicitudModel $model */
        $fechaAusencia = $model->fecha_ausencia instanceof \DateTimeInterface
            ? DateTimeImmutable::createFromInterface($model->fecha_ausencia)
            : new DateTimeImmutable((string) $model->fecha_ausencia);

        $estado = $model->estado instanceof EstadoSolicitud
            ? $model->estado
            : EstadoSolicitud::from($model->estado);

        return SolicitudEntity::reconstruir(
            (int) $model->id,
            $fechaAusencia,
            ArchivoConstancia::fromNullable($model->constancia),
            $model->observaciones ?? '',
            $model->respuesta,
            $estado,
            (int) $model->estudiante_id,
            (int) $model->docente_id,
            (int) $model->asignatura_id,
            (int) $model->tipo_constancia_id
        );
    }

    protected function mapToModel(Entity $entity): Model
    {
        /** @var SolicitudEntity $entity */
        $modelClass = $this->modelClass();

        /** @var SolicitudModel $model */
        $model = $entity->id() !== null
            ? $modelClass::findOrFail($entity->id()->value())
            : new $modelClass();

        $model->fill([
            'fecha_ausencia' => $entity->fechaAusencia()->format('Y-m-d'),
            'constancia' => $entity->constancia()?->path(),
            'observaciones' => $entity->observaciones()->value(),
            'respuesta' => $entity->respuesta()?->value(),
            'estado' => $entity->estado(),
            'estudiante_id' => $entity->estudianteId()->value(),
            'docente_id' => $entity->docenteId()->value(),
            'asignatura_id' => $entity->asignaturaId()->value(),
            'tipo_constancia_id' => $entity->tipoConstanciaId()->value(),
        ]);

        return $model;
    }
}
