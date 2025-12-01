<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Solicitud\Entities\Solicitud as SolicitudEntity;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use App\Domain\Shared\Enums\EstadoApelacion;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Domain\Shared\OptimisticLockException;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\SolicitudMapper;
use App\Models\ModuloEstudiante\Solicitud as SolicitudModel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class EloquentSolicitudRepository implements SolicitudRepository
{
    public function __construct(
        private readonly SolicitudMapper $mapper,
    ) {
    }

    public function paginateByEstadoForEstudiante(int $estudianteId, EstadoSolicitud $estado, int $perPage = 9): LengthAwarePaginator
    {
        $paginator = SolicitudModel::with(['docente.usuario', 'asignatura'])
            ->where('estado', $estado)
            ->where('estudiante_id', $estudianteId)
            ->when(
                $estado === EstadoSolicitud::Rechazada,
                fn($query) => $query->whereDoesntHave('apelaciones', fn($q) => $q->where('estado', EstadoApelacion::Pendiente))
            )
            ->orderByDesc('id')
            ->paginate($perPage);

        $paginator->setCollection(
            $this->mapCollectionToEntities($paginator->getCollection())
        );

        return $paginator;
    }

    public function paginateByEstadoForSecretaria(EstadoSolicitud $estado, bool $sinApelacionesPendientes, int $perPage = 9): LengthAwarePaginator
    {
        $paginator = SolicitudModel::with(['docente.usuario', 'asignatura', 'estudiante.usuario'])
            ->where('estado', $estado)
            ->when(
                $sinApelacionesPendientes,
                fn($query) => $query->whereDoesntHave('apelaciones', fn($q) => $q->where('estado', EstadoApelacion::Pendiente))
            )
            ->orderByDesc('id')
            ->paginate($perPage);

        $paginator->setCollection(
            $this->mapCollectionToEntities($paginator->getCollection())
        );

        return $paginator;
    }

    public function findById(int $id): SolicitudEntity
    {
        $model = SolicitudModel::findOrFail($id);

        return $this->mapper->toEntity($model);
    }

    public function create(SolicitudEntity $solicitud): SolicitudEntity
    {
        $model = $this->mapper->toModel($solicitud);
        $model->save();

        return $this->mapper->toEntity($model->fresh());
    }

    public function update(SolicitudEntity $solicitud): SolicitudEntity
    {
        $id = $solicitud->id()?->value();

        if ($id === null) {
            throw OptimisticLockException::withMessage('No se puede actualizar una solicitud sin identificador.');
        }

        $expectedVersion = $solicitud->version();
        $payload = array_merge(
            $solicitud->payloadParaActualizacion(),
            [
                'respuesta' => $solicitud->respuesta()?->value(),
                'estado' => $solicitud->estado()->value,
                'version' => $expectedVersion + 1,
            ]
        );

        $updated = SolicitudModel::query()
            ->whereKey($id)
            ->where('version', $expectedVersion)
            ->update($payload);

        if ($updated === 0) {
            $currentVersion = SolicitudModel::query()->whereKey($id)->value('version');

            throw OptimisticLockException::conflicted(
                'Solicitud',
                $id,
                $expectedVersion,
                $currentVersion !== null ? (int) $currentVersion : null
            );
        }

        return $this->mapper->toEntity(SolicitudModel::findOrFail($id));
    }

    public function delete(SolicitudEntity $solicitud): void
    {
        $this->mapper->toModel($solicitud)->delete();
    }

    public function solicitudesAprobadasSinReprogramacion(int $docenteId): iterable
    {
        return SolicitudModel::with(['estudiante.usuario', 'asignatura'])
            ->where('estado', EstadoSolicitud::Aprobada)
            ->where('docente_id', $docenteId)
            ->doesntHave('reprogramacion')
            ->orderByDesc('id')
            ->get()
            ->map(fn(SolicitudModel $solicitud) => $this->mapper->toEntity($solicitud));
    }

    public function reprogramacionesPorDocente(int $docenteId): iterable
    {
        return SolicitudModel::with(['reprogramacion', 'estudiante.usuario', 'asignatura'])
            ->where('docente_id', $docenteId)
            ->whereHas('reprogramacion')
            ->orderByDesc('id')
            ->get()
            ->map(fn(SolicitudModel $solicitud) => $this->mapper->toEntity($solicitud));
    }

    private function mapCollectionToEntities(Collection $collection): Collection
    {
        return $collection->map(fn(SolicitudModel $solicitud) => $this->mapper->toEntity($solicitud));
    }
}
