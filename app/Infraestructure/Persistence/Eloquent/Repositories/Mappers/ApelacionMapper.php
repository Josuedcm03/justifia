<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Models\ModuloEstudiante\Apelacion;

class ApelacionMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return Apelacion::class;
    }
}
