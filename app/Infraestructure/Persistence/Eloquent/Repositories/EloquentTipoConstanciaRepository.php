<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\TipoConstanciaMapper;
use App\Models\ModuloSecretaria\TipoConstancia;
use Illuminate\Support\Collection;

class EloquentTipoConstanciaRepository implements TipoConstanciaRepository
{
    public function __construct(
        private readonly TipoConstanciaMapper $mapper,
    ) {
    }

    public function all(): Collection
    {
        return TipoConstancia::orderBy('nombre')
            ->get()
            ->map(fn(TipoConstancia $tipo) => $this->mapper->toEntity($tipo));
    }
}