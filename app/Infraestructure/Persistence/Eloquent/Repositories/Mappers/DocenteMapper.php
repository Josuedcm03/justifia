<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Models\ModuloSecretaria\Docente;

class DocenteMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return Docente::class;
    }
}
