<?php

namespace App\Infraestructure\Persistence\Eloquent\Repositories;

use App\Domain\Docente\Repositories\DocenteRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\DocenteMapper;
use App\Models\ModuloSecretaria\Docente as DocenteModel;

class EloquentDocenteRepository implements DocenteRepository
{
    public function __construct(
        private readonly DocenteMapper $mapper,
    ) {
    }

    public function allWithUsuario(): iterable
    {
        return DocenteModel::with('usuario')
            ->get()
            ->map(fn(DocenteModel $docente) => $this->mapper->toEntity($docente));
    }

    public function searchByNombre(string $nombre, int $limit = 10): iterable
    {
        return DocenteModel::with('usuario')
            ->when($nombre !== '', function ($query) use ($nombre) {
                $query->whereHas('usuario', fn($q) => $q->where('name', 'like', "%{$nombre}%"));
            })
            ->limit($limit)
            ->get()
            ->map(fn(DocenteModel $docente) => $this->mapper->toEntity($docente));
    }
}