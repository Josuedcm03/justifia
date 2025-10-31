<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\TipoConstanciaMapper;
use App\Models\ModuloSecretaria\TipoConstancia as TipoConstanciaModel;

class EloquentTipoConstanciaRepository implements TipoConstanciaRepository
{
    public function __construct(
        private readonly TipoConstanciaMapper $mapper,
    ) {
    }

    public function all(): iterable
    {
        return TipoConstanciaModel::orderBy('nombre')
            ->get()
            ->map(fn(TipoConstanciaModel $tipo) => $this->mapper->toEntity($tipo));
    }
}