<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use App\Enums\EstadoApelacion;
use App\Enums\EstadoSolicitud;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class EloquentSolicitudRepository implements SolicitudRepository
{
    public function __construct(
        private readonly SolicitudMapper $mapper,
    ) {
    }

    public function paginateByEstadoForEstudiante(int $estudianteId, EstadoSolicitud $estado, int $perPage = 9): LengthAwarePaginator
    {
        $paginator = Solicitud::with(['docente.usuario', 'asignatura'])
            ->where('estado', $estado)
            ->where('estudiante_id', $estudianteId)
            ->when(
                $estado === EstadoSolicitud::Rechazada,
                fn($query) => $query->whereDoesntHave('apelaciones', fn($q) => $q->where('estado', EstadoApelacion::Pendiente))
            )
            ->orderByDesc('id')
            ->paginate($perPage);

        $paginator->setCollection(
            $paginator->getCollection()->map(fn(Solicitud $solicitud) => $this->mapper->toEntity($solicitud))
        );

        return $paginator;
    }

    public function paginateByEstadoForSecretaria(EstadoSolicitud $estado, bool $sinApelacionesPendientes, int $perPage = 9): LengthAwarePaginator
    {
        $paginator = Solicitud::with(['docente.usuario', 'asignatura', 'estudiante.usuario'])
            ->where('estado', $estado)
            ->when(
                $sinApelacionesPendientes,
                fn($query) => $query->whereDoesntHave('apelaciones', fn($q) => $q->where('estado', EstadoApelacion::Pendiente))
            )
            ->orderByDesc('id')
            ->paginate($perPage);

        $paginator->setCollection(
            $paginator->getCollection()->map(fn(Solicitud $solicitud) => $this->mapper->toEntity($solicitud))
        );

        return $paginator;
    }

    public function create(array $data): Solicitud
    {
        return $this->mapper->toEntity(Solicitud::create($data));
    }

    public function update(Solicitud $solicitud, array $data): Solicitud
    {
        $model = $this->mapper->toModel($solicitud);
        $model->update($data);

        return $this->mapper->toEntity($model->refresh());
    }

    public function delete(Solicitud $solicitud): void
    {
        $this->mapper->toModel($solicitud)->delete();
    }

    public function solicitudesAprobadasSinReprogramacion(int $docenteId): iterable
    {
        return Solicitud::with(['estudiante.usuario', 'asignatura'])
            ->where('estado', EstadoSolicitud::Aprobada)
            ->where('docente_id', $docenteId)
            ->doesntHave('reprogramacion')
            ->orderByDesc('id')
            ->get()
            ->map(fn(Solicitud $solicitud) => $this->mapper->toEntity($solicitud));
    }

    public function reprogramacionesPorDocente(int $docenteId): iterable
    {
        return Solicitud::with(['reprogramacion', 'estudiante.usuario', 'asignatura'])
            ->where('docente_id', $docenteId)
            ->whereHas('reprogramacion')
            ->orderByDesc('id')
            ->get()
            ->map(fn(Solicitud $solicitud) => $this->mapper->toEntity($solicitud));
    }
}