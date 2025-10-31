<?php

namespace App\Application\Apelaciones;

use App\Domain\Apelaciones\Repositories\ApelacionRepository;
use App\Enums\EstadoApelacion;
use App\Domain\Apelaciones\Entities\Apelacion;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class ApelacionService
{
    public function __construct(private readonly ApelacionRepository $apelaciones)
    {
    }

    public function listarFinalesPorEstudiante(int $estudianteId): Collection
    {
        return $this->apelaciones->listarFinalesPorEstudiante($estudianteId);
    }

    public function obtenerUltimaDeSolicitud(int $solicitudId): ?Apelacion
    {
        return $this->apelaciones->obtenerUltimaPorSolicitud($solicitudId);
    }

    public function obtenerUltimaRechazada(int $solicitudId): ?Apelacion
    {
        return $this->apelaciones->obtenerUltimaRechazada($solicitudId);
    }

    public function crear(array $data): Apelacion
    {
        return $this->apelaciones->crear($data);
    }

    public function actualizar(Apelacion $apelacion, array $data): Apelacion
    {
        return $this->apelaciones->actualizar($apelacion, $data);
    }

    public function paginarPorEstado(EstadoApelacion $estado, int $perPage = 9): LengthAwarePaginator
    {
        return $this->apelaciones->paginarPorEstado($estado, $perPage);
    }
}