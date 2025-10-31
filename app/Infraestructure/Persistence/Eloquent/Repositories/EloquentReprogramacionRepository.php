<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;
use App\Models\ModuloDocente\Reprogramacion;

class EloquentReprogramacionRepository implements ReprogramacionRepository
{
    public function create(array $data): Reprogramacion
    {
        return Reprogramacion::create($data);
    }

    public function update(Reprogramacion $reprogramacion, array $data): Reprogramacion
    {
        $reprogramacion->update($data);

        return $reprogramacion->refresh();
    }
}