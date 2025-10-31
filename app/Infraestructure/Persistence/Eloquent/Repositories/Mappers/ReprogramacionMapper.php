<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Models\ModuloDocente\Reprogramacion;

class ReprogramacionMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return Reprogramacion::class;
    }
}
