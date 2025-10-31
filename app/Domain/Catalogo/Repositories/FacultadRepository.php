<?php

namespace App\Domain\Catalogo\Repositories;

use Illuminate\Support\Collection;

interface FacultadRepository
{
    public function allOrdered(): Collection;
}