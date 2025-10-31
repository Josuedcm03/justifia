<?php

namespace App\Domain\Solicitud\Repositories;

use App\Enums\EstadoSolicitud;
use App\Models\ModuloEstudiante\Solicitud;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface SolicitudRepository
{
    public function paginateByEstadoForEstudiante(int $estudianteId, EstadoSolicitud $estado, int $perPage = 9): LengthAwarePaginator;

    public function paginateByEstadoForSecretaria(EstadoSolicitud $estado, bool $sinApelacionesPendientes, int $perPage = 9): LengthAwarePaginator;

    public function create(array $data): Solicitud;

    public function update(Solicitud $solicitud, array $data): Solicitud;

    public function delete(Solicitud $solicitud): void;

    public function solicitudesAprobadasSinReprogramacion(int $docenteId): Collection;

    public function reprogramacionesPorDocente(int $docenteId): Collection;
}