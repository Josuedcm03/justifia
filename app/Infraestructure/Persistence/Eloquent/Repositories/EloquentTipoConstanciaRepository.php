<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;
use App\Models\ModuloSecretaria\TipoConstancia;
use Illuminate\Support\Collection;

class EloquentTipoConstanciaRepository implements TipoConstanciaRepository
{
    public function all(): Collection
    {
        return TipoConstancia::orderBy('nombre')->get();
    }
}