<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\DTOs\AsignaturaListadoItem;
use App\Application\Catalogo\Queries\PaginarAsignaturasQuery;
use App\Domain\Catalogo\Entities\Asignatura;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;
use App\Domain\Catalogo\Repositories\FacultadRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final class PaginarAsignaturasHandler
{
    public function __construct(
        private readonly AsignaturaRepository $asignaturas,
        private readonly FacultadRepository $facultades,
    ) {
    }

    public function handle(PaginarAsignaturasQuery $query): LengthAwarePaginator
    {
        $facultades = collect($this->facultades->allOrdered())
            ->mapWithKeys(fn($facultad) => [$facultad->id()?->value() => $facultad->nombre()->value()])
            ->all();

        return $this->asignaturas->paginate($query->termino(), $query->perPage())
            ->through(fn(Asignatura $asignatura) => new AsignaturaListadoItem(
                $asignatura,
                $facultades[$asignatura->facultadId()->value()] ?? null,
            ));
    }
}
