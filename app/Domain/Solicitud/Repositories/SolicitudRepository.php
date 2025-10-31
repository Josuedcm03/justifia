<?php

namespace App\Domain\Solicitud\Repositories;

use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Shared\Enums\EstadoSolicitud;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface SolicitudRepository
{
    public function paginateByEstadoForEstudiante(int $estudianteId, EstadoSolicitud $estado, int $perPage = 9): LengthAwarePaginator;

    public function paginateByEstadoForSecretaria(EstadoSolicitud $estado, bool $sinApelacionesPendientes, int $perPage = 9): LengthAwarePaginator;

    public function findById(int $id): Solicitud;

    public function create(Solicitud $solicitud): Solicitud;

    public function update(Solicitud $solicitud): Solicitud;

    public function delete(Solicitud $solicitud): void;

    /** @return iterable<Solicitud> */
    public function solicitudesAprobadasSinReprogramacion(int $docenteId): iterable;

    /** @return iterable<Solicitud> */
    public function reprogramacionesPorDocente(int $docenteId): iterable;
}