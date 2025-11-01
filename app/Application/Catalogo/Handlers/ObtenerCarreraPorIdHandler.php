<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Queries\ObtenerCarreraPorIdQuery;
use App\Domain\Catalogo\Entities\Carrera;
use App\Domain\Catalogo\Repositories\CarreraRepository;

final class ObtenerCarreraPorIdHandler
{
    public function __construct(private readonly CarreraRepository $carreras)
    {
    }

    public function handle(ObtenerCarreraPorIdQuery $query): Carrera
    {
        return $this->carreras->findById($query->id());
    }
}
