<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Entities\Facultad;
use App\Domain\Catalogo\Repositories\FacultadRepository;

class EloquentFacultadRepository implements FacultadRepository
{
    public function allOrdered(): iterable
    {
        return Facultad::orderBy('nombre')
            ->get()
            ->map(fn(Facultad $facultad) => $this->mapper->toEntity($facultad));
    }
}