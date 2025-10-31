<?php

namespace App\Domain\Docente\Repositories;

use Illuminate\Support\Collection;

interface DocenteRepository
{
    public function allWithUsuario(): Collection;

    public function searchByNombre(string $nombre, int $limit = 10): Collection;
}