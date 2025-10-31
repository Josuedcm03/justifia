<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories\Mappers;

use App\Models\ModuloSecretaria\TipoConstancia;

class TipoConstanciaMapper extends AggregateMapper
{
    protected function modelClass(): string
    {
        return TipoConstancia::class;
    }
}
