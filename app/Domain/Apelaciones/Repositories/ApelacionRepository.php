<?php

namespace App\Domain\Apelaciones\Repositories;

use App\Domain\Apelaciones\Entities\Apelacion;
use App\Enums\EstadoApelacion;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface ApelacionRepository
{
    /** @return iterable<Apelacion> */
    public function listarFinalesPorEstudiante(int $estudianteId): iterable;

    public function obtenerUltimaPorSolicitud(int $solicitudId): ?Apelacion;

    public function obtenerUltimaRechazada(int $solicitudId): ?Apelacion;

    public function crear(array $data): Apelacion;

    public function actualizar(Apelacion $apelacion, array $data): Apelacion;

    public function paginarPorEstado(EstadoApelacion $estado, int $perPage = 9): LengthAwarePaginator;
}