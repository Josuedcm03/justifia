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

    public function findById(int $id): Apelacion;

    public function crear(Apelacion $apelacion): Apelacion;

    public function actualizar(Apelacion $apelacion): Apelacion;

    public function paginarPorEstado(EstadoApelacion $estado, int $perPage = 9): LengthAwarePaginator;
}