<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Repositories\FacultadRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\FacultadMapper;
use App\Models\ModuloSecretaria\Facultad as FacultadModel;

class EloquentFacultadRepository implements FacultadRepository
{
    public function __construct(
        private readonly FacultadMapper $mapper,
    ) {
    }

    public function allOrdered(): iterable
    {
        return FacultadModel::orderBy('nombre')
            ->get()
            ->map(fn(FacultadModel $facultad) => $this->mapper->toEntity($facultad));
    }
}