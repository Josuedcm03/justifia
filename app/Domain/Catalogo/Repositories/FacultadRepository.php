<?php

namespace App\Domain\Catalogo\Repositories;

use App\Domain\Catalogo\Entities\Facultad;

interface FacultadRepository
{
    /** @return iterable<Facultad> */
    public function allOrdered(): iterable;
}