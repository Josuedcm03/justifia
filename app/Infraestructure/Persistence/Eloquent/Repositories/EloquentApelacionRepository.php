<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Apelaciones\Repositories\ApelacionRepository;
use App\Enums\EstadoApelacion;
use App\Domain\Apelaciones\Entities\Apelacion;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class EloquentApelacionRepository implements ApelacionRepository
{
    public function listarFinalesPorEstudiante(int $estudianteId): Collection
    {
        return Apelacion::whereDoesntHave('apelacionesHijas')
            ->whereHas('solicitud', fn($q) => $q->where('estudiante_id', $estudianteId))
            ->with('solicitud')
            ->orderByDesc('id')
            ->get();
    }

    public function obtenerUltimaPorSolicitud(int $solicitudId): ?Apelacion
    {
        return Apelacion::where('solicitud_id', $solicitudId)
            ->orderByDesc('id')
            ->first();
    }

    public function obtenerUltimaRechazada(int $solicitudId): ?Apelacion
    {
        return Apelacion::where('solicitud_id', $solicitudId)
            ->where('estado', EstadoApelacion::Rechazada)
            ->orderByDesc('id')
            ->first();
    }

    public function crear(array $data): Apelacion
    {
        return Apelacion::create($data);
    }

    public function actualizar(Apelacion $apelacion, array $data): Apelacion
    {
        $apelacion->update($data);

        return $apelacion->refresh();
    }

    public function paginarPorEstado(EstadoApelacion $estado, int $perPage = 9): LengthAwarePaginator
    {
        return Apelacion::where('estado', $estado)
            ->whereDoesntHave('apelacionesHijas')
            ->with('solicitud')
            ->orderByDesc('id')
            ->paginate($perPage);
    }
}