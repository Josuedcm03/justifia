<?php

namespace App\Domain\Catalogo\Repositories;

use Illuminate\Support\Collection;

interface TipoConstanciaRepository
{
    public function all(): Collection;
}