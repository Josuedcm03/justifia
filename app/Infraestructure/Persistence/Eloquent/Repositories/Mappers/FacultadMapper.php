<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Models\ModuloSecretaria\Facultad;

class FacultadMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return Facultad::class;
    }
}
