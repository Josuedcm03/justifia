<?php

namespace App\Domain\Catalogo\Repositories;

use App\Domain\Catalogo\Entities\TipoConstancia;

interface TipoConstanciaRepository
{
    /** @return iterable<TipoConstancia> */
    public function all(): iterable;
}