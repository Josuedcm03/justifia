<?php

namespace App\Application\Catalogo\Handlers;

use App\Application\Catalogo\DTOs\CarreraListadoItem;
use App\Application\Catalogo\Queries\PaginarCarrerasQuery;
use App\Domain\Catalogo\Entities\Carrera;
use App\Domain\Catalogo\Repositories\CarreraRepository;
use App\Domain\Catalogo\Repositories\FacultadRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final class PaginarCarrerasHandler
{
    public function __construct(
        private readonly CarreraRepository $carreras,
        private readonly FacultadRepository $facultades,
    ) {
    }

    public function handle(PaginarCarrerasQuery $query): LengthAwarePaginator
    {
        $facultades = $this->facultadesIndex();

        return $this->carreras->paginate($query->perPage())
            ->through(fn(Carrera $carrera) => new CarreraListadoItem(
                $carrera,
                $facultades[$carrera->facultadId()->value()] ?? null,
            ));
    }

    /**
     * @return array<int, string>
     */
    private function facultadesIndex(): array
    {
        return collect($this->facultades->allOrdered())
            ->mapWithKeys(
                fn($facultad) => [$facultad->id()?->value() => $facultad->nombre()->value()]
            )
            ->all();
    }
}
