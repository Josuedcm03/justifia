<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Models\ModuloSecretaria\Asignatura;

class AsignaturaMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return Asignatura::class;
    }
}
