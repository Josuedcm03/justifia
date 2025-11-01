<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\Queries\PaginarTipoConstanciasQuery;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final class PaginarTipoConstanciasHandler
{
    public function __construct(private readonly TipoConstanciaRepository $tipos)
    {
    }

    public function handle(PaginarTipoConstanciasQuery $query): LengthAwarePaginator
    {
        return $this->tipos->paginate($query->perPage());
    }
}
