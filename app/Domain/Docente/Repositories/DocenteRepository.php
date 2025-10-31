<?php

namespace App\Domain\Docente\Repositories;

use App\Domain\Docente\Entities\Docente;

interface DocenteRepository
{
    /** @return iterable<Docente> */
    public function allWithUsuario(): iterable;

    /** @return iterable<Docente> */
    public function searchByNombre(string $nombre, int $limit = 10): iterable;
}