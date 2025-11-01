<?php

namespace App\Application\Apelaciones\Handlers;

use App\Application\Apelaciones\Queries\ObtenerApelacionPorIdQuery;
use App\Domain\Apelaciones\Entities\Apelacion;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;

final class ObtenerApelacionPorIdHandler
{
    public function __construct(private readonly ApelacionRepository $apelaciones)
    {
    }

    public function handle(ObtenerApelacionPorIdQuery $query): Apelacion
    {
        return $this->apelaciones->findById($query->apelacionId());
    }
}
