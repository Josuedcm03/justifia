<?php

namespace App\Domain\Apelaciones\Repositories;

use App\Enums\EstadoApelacion;
use App\Models\ModuloEstudiante\Apelacion;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface ApelacionRepository
{
    public function listarFinalesPorEstudiante(int $estudianteId): Collection;

    public function obtenerUltimaPorSolicitud(int $solicitudId): ?Apelacion;

    public function obtenerUltimaRechazada(int $solicitudId): ?Apelacion;

    public function crear(array $data): Apelacion;

    public function actualizar(Apelacion $apelacion, array $data): Apelacion;

    public function paginarPorEstado(EstadoApelacion $estado, int $perPage = 9): LengthAwarePaginator;
}