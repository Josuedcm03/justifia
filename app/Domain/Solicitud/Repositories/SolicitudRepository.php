<?php

namespace App\Domain\Solicitud\Repositories;

use App\Domain\Solicitud\Entities\Solicitud;
use App\Enums\EstadoSolicitud;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface SolicitudRepository
{
    public function paginateByEstadoForEstudiante(int $estudianteId, EstadoSolicitud $estado, int $perPage = 9): LengthAwarePaginator;

    public function paginateByEstadoForSecretaria(EstadoSolicitud $estado, bool $sinApelacionesPendientes, int $perPage = 9): LengthAwarePaginator;

    public function create(array $data): Solicitud;

    public function update(Solicitud $solicitud, array $data): Solicitud;

    public function delete(Solicitud $solicitud): void;

    /** @return iterable<Solicitud> */
    public function solicitudesAprobadasSinReprogramacion(int $docenteId): iterable;

    /** @return iterable<Solicitud> */
    public function reprogramacionesPorDocente(int $docenteId): iterable;
}