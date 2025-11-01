<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Solicitudes\Queries\PaginarSolicitudesSecretariaQuery;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final class PaginarSolicitudesSecretariaHandler
{
    public function __construct(private readonly SolicitudRepository $solicitudes)
    {
    }

    public function handle(PaginarSolicitudesSecretariaQuery $query): LengthAwarePaginator
    {
        return $this->solicitudes->paginateByEstadoForSecretaria(
            $query->estado(),
            $query->sinApelacionesPendientes(),
            $query->perPage()
        );
    }
}
