<?php

namespace App\Domain\Catalogo\Repositories;

use App\Domain\Catalogo\Entities\TipoConstancia;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface TipoConstanciaRepository
{
    /** @return iterable<TipoConstancia> */
    public function all(): iterable;

    public function paginate(int $perPage = 10): LengthAwarePaginator;

    public function findById(int $id): TipoConstancia;

    public function create(TipoConstancia $tipoConstancia): TipoConstancia;

    public function update(TipoConstancia $tipoConstancia): TipoConstancia;

    public function delete(TipoConstancia $tipoConstancia): void;
}