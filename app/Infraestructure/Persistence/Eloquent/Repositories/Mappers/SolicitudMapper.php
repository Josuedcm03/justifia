<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Models\ModuloEstudiante\Solicitud;

class SolicitudMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return Solicitud::class;
    }
}
