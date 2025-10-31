<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Solicitud\Repositories\SolicitudRepository;
use App\Enums\EstadoApelacion;
use App\Enums\EstadoSolicitud;
use App\Models\ModuloEstudiante\Solicitud;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class EloquentSolicitudRepository implements SolicitudRepository
{
    public function paginateByEstadoForEstudiante(int $estudianteId, EstadoSolicitud $estado, int $perPage = 9): LengthAwarePaginator
    {
        return Solicitud::with(['docente.usuario', 'asignatura'])
            ->where('estado', $estado)
            ->where('estudiante_id', $estudianteId)
            ->when(
                $estado === EstadoSolicitud::Rechazada,
                fn($query) => $query->whereDoesntHave('apelaciones', fn($q) => $q->where('estado', EstadoApelacion::Pendiente))
            )
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    public function paginateByEstadoForSecretaria(EstadoSolicitud $estado, bool $sinApelacionesPendientes, int $perPage = 9): LengthAwarePaginator
    {
        return Solicitud::with(['docente.usuario', 'asignatura', 'estudiante.usuario'])
            ->where('estado', $estado)
            ->when(
                $sinApelacionesPendientes,
                fn($query) => $query->whereDoesntHave('apelaciones', fn($q) => $q->where('estado', EstadoApelacion::Pendiente))
            )
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    public function create(array $data): Solicitud
    {
        return Solicitud::create($data);
    }

    public function update(Solicitud $solicitud, array $data): Solicitud
    {
        $solicitud->update($data);

        return $solicitud->refresh();
    }

    public function delete(Solicitud $solicitud): void
    {
        $solicitud->delete();
    }

    public function solicitudesAprobadasSinReprogramacion(int $docenteId): Collection
    {
        return Solicitud::with(['estudiante.usuario', 'asignatura'])
            ->where('estado', EstadoSolicitud::Aprobada)
            ->where('docente_id', $docenteId)
            ->doesntHave('reprogramacion')
            ->orderByDesc('id')
            ->get();
    }

    public function reprogramacionesPorDocente(int $docenteId): Collection
    {
        return Solicitud::with(['reprogramacion', 'estudiante.usuario', 'asignatura'])
            ->where('docente_id', $docenteId)
            ->whereHas('reprogramacion')
            ->orderByDesc('id')
            ->get();
    }
}