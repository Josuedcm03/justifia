<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Repositories\FacultadRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\FacultadMapper;
use App\Models\ModuloSecretaria\Facultad;
use Illuminate\Support\Collection;

class EloquentFacultadRepository implements FacultadRepository
{
    public function __construct(
        private readonly FacultadMapper $mapper,
    ) {
    }

    public function allOrdered(): Collection
    {
        return Facultad::orderBy('nombre')
            ->get()
            ->map(fn(Facultad $facultad) => $this->mapper->toEntity($facultad));
    }
}