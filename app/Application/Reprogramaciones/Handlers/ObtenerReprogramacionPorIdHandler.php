<?php

namespace App\Application\Reprogramaciones\Handlers;

use App\Application\Reprogramaciones\Queries\ObtenerReprogramacionPorIdQuery;
use App\Domain\Reprogramacion\Entities\Reprogramacion;
use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;

final class ObtenerReprogramacionPorIdHandler
{
    public function __construct(private readonly ReprogramacionRepository $reprogramaciones)
    {
    }

    public function handle(ObtenerReprogramacionPorIdQuery $query): Reprogramacion
    {
        return $this->reprogramaciones->findById($query->reprogramacionId());
    }
}
