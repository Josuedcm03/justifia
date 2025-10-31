<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Catalogo\Repositories\FacultadRepository;
use App\Models\ModuloSecretaria\Facultad;
use Illuminate\Support\Collection;

class EloquentFacultadRepository implements FacultadRepository
{
    public function allOrdered(): Collection
    {
        return Facultad::orderBy('nombre')->get();
    }
}