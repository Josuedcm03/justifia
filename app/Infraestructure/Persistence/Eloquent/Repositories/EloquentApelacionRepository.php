<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Apelaciones\Entities\Apelacion;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;
use App\Enums\EstadoApelacion;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class EloquentApelacionRepository implements ApelacionRepository
{
    public function listarFinalesPorEstudiante(int $estudianteId): iterable
    {
        return Apelacion::whereDoesntHave('apelacionesHijas')
            ->whereHas('solicitud', fn($q) => $q->where('estudiante_id', $estudianteId))
            ->with('solicitud')
            ->orderByDesc('id')
            ->get()
            ->map(fn(Apelacion $apelacion) => $this->mapper->toEntity($apelacion));
    }

    public function obtenerUltimaPorSolicitud(int $solicitudId): ?Apelacion
    {
        $model = Apelacion::where('solicitud_id', $solicitudId)
            ->orderByDesc('id')
            ->first();

        return $model ? $this->mapper->toEntity($model) : null;
    }

    public function obtenerUltimaRechazada(int $solicitudId): ?Apelacion
    {
        $model = Apelacion::where('solicitud_id', $solicitudId)
            ->where('estado', EstadoApelacion::Rechazada)
            ->orderByDesc('id')
            ->first();

        return $model ? $this->mapper->toEntity($model) : null;
    }

    public function crear(array $data): Apelacion
    {
        return $this->mapper->toEntity(Apelacion::create($data));
    }

    public function actualizar(Apelacion $apelacion, array $data): Apelacion
    {
        $model = $this->mapper->toModel($apelacion);
        $model->update($data);

        return $this->mapper->toEntity($model->refresh());
    }

    public function paginarPorEstado(EstadoApelacion $estado, int $perPage = 9): LengthAwarePaginator
    {
        $paginator = Apelacion::where('estado', $estado)
            ->whereDoesntHave('apelacionesHijas')
            ->with('solicitud')
            ->orderByDesc('id')
            ->paginate($perPage);

        $paginator->setCollection(
            $paginator->getCollection()->map(fn(Apelacion $apelacion) => $this->mapper->toEntity($apelacion))
        );

        return $paginator;
    }
}