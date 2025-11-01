<?php

namespace App\Application\Apelaciones\Handlers;

use App\Application\Apelaciones\Queries\PaginarApelacionesPorEstadoQuery;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final class PaginarApelacionesPorEstadoHandler
{
    public function __construct(private readonly ApelacionRepository $apelaciones)
    {
    }

    public function handle(PaginarApelacionesPorEstadoQuery $query): LengthAwarePaginator
    {
        return $this->apelaciones->paginarPorEstado($query->estado(), $query->perPage());
    }
}
