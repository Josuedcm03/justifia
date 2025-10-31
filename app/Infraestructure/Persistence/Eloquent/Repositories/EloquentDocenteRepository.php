<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Docente\Entities\Docente;
use App\Domain\Docente\Repositories\DocenteRepository;

class EloquentDocenteRepository implements DocenteRepository
{
    public function allWithUsuario(): iterable
    {
        return Docente::with('usuario')->get();
    }

    public function searchByNombre(string $nombre, int $limit = 10): iterable
    {
        return Docente::with('usuario')
            ->when($nombre !== '', function ($query) use ($nombre) {
                $query->whereHas('usuario', fn($q) => $q->where('name', 'like', "%{$nombre}%"));
            })
            ->limit($limit)
            ->get();
    }
}