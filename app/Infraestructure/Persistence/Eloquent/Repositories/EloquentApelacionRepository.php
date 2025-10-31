<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Apelaciones\Entities\Apelacion as ApelacionEntity;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;
use App\Enums\EstadoApelacion;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\ApelacionMapper;
use App\Models\ModuloEstudiante\Apelacion as ApelacionModel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class EloquentApelacionRepository implements ApelacionRepository
{
    public function __construct(
        private readonly ApelacionMapper $mapper,
    ) {
    }

    public function listarFinalesPorEstudiante(int $estudianteId): iterable
    {
        return ApelacionModel::whereDoesntHave('apelacionesHijas')
            ->whereHas('solicitud', fn($q) => $q->where('estudiante_id', $estudianteId))
            ->with('solicitud')
            ->orderByDesc('id')
            ->get()
            ->map(fn(ApelacionModel $apelacion) => $this->mapper->toEntity($apelacion));
    }

    public function obtenerUltimaPorSolicitud(int $solicitudId): ?ApelacionEntity
    {
        $model = ApelacionModel::where('solicitud_id', $solicitudId)
            ->orderByDesc('id')
            ->first();

        return $model ? $this->mapper->toEntity($model) : null;
    }

    public function obtenerUltimaRechazada(int $solicitudId): ?ApelacionEntity
    {
        $model = ApelacionModel::where('solicitud_id', $solicitudId)
            ->where('estado', EstadoApelacion::Rechazada)
            ->orderByDesc('id')
            ->first();

        return $model ? $this->mapper->toEntity($model) : null;
    }

    public function findById(int $id): ApelacionEntity
    {
        $model = ApelacionModel::findOrFail($id);

        return $this->mapper->toEntity($model);
    }

    public function crear(ApelacionEntity $apelacion): ApelacionEntity
    {
        $model = $this->mapper->toModel($apelacion);
        $model->save();

        return $this->mapper->toEntity($model->fresh());
    }

    public function actualizar(ApelacionEntity $apelacion): ApelacionEntity
    {
        $model = $this->mapper->toModel($apelacion);
        $model->save();

        return $this->mapper->toEntity($model->fresh());
    }

    public function paginarPorEstado(EstadoApelacion $estado, int $perPage = 9): LengthAwarePaginator
    {
        $paginator = ApelacionModel::where('estado', $estado)
            ->whereDoesntHave('apelacionesHijas')
            ->with('solicitud')
            ->orderByDesc('id')
            ->paginate($perPage);

        $paginator->setCollection(
            $paginator->getCollection()->map(fn(ApelacionModel $apelacion) => $this->mapper->toEntity($apelacion))
        );

        return $paginator;
    }
}