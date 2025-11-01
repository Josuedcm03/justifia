<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Solicitudes\Queries\PaginarSolicitudesEstudianteQuery;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final class PaginarSolicitudesEstudianteHandler
{
    public function __construct(private readonly SolicitudRepository $solicitudes)
    {
    }

    public function handle(PaginarSolicitudesEstudianteQuery $query): LengthAwarePaginator
    {
        return $this->solicitudes->paginateByEstadoForEstudiante(
            $query->estudianteId(),
            $query->estado(),
            $query->perPage()
        );
    }
}
