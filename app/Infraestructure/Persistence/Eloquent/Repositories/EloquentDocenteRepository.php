<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Docente\Repositories\DocenteRepository;
use App\Models\ModuloSecretaria\Docente;
use Illuminate\Support\Collection;

class EloquentDocenteRepository implements DocenteRepository
{
    public function allWithUsuario(): Collection
    {
        return Docente::with('usuario')->get();
    }

    public function searchByNombre(string $nombre, int $limit = 10): Collection
    {
        return Docente::with('usuario')
            ->when($nombre !== '', function ($query) use ($nombre) {
                $query->whereHas('usuario', fn($q) => $q->where('name', 'like', "%{$nombre}%"));
            })
            ->limit($limit)
            ->get();
    }
}