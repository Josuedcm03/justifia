<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Entities\TipoConstancia;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;

class EloquentTipoConstanciaRepository implements TipoConstanciaRepository
{
    public function all(): iterable
    {
        return TipoConstancia::orderBy('nombre')->get();
    }
}