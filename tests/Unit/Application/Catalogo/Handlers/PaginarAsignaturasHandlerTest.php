<?php

namespace Tests\Unit\Application\Catalogo\Handlers;

use App\Application\Catalogo\DTOs\PaginarAsignaturasDTO;
use App\Application\Catalogo\Handlers\PaginarAsignaturasHandler;
use App\Application\Catalogo\Queries\PaginarAsignaturasQuery;
use App\Domain\Catalogo\Entities\Asignatura;
use App\Domain\Catalogo\Entities\Facultad;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;
use App\Domain\Catalogo\Repositories\FacultadRepository;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

final class PaginarAsignaturasHandlerTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    public function test_it_maps_asignaturas_with_facultad_names(): void
    {
        $asignaturasRepo = Mockery::mock(AsignaturaRepository::class);
        $facultadesRepo = Mockery::mock(FacultadRepository::class);

        $asignaturas = new Collection([
            Asignatura::reconstruir(10, 'Cálculo', 4),
            Asignatura::reconstruir(11, 'Anatomía', 5),
        ]);

        $paginator = new LengthAwarePaginator($asignaturas, $asignaturas->count(), 15);

        $asignaturasRepo->shouldReceive('paginate')
            ->once()
            ->with('busqueda', 15)
            ->andReturn($paginator);

        $facultadesRepo->shouldReceive('allOrdered')
            ->once()
            ->andReturn([
                Facultad::reconstruir(4, 'Exactas'),
                Facultad::reconstruir(5, 'Salud'),
            ]);

        $handler = new PaginarAsignaturasHandler($asignaturasRepo, $facultadesRepo);

        $result = $handler->handle(
            new PaginarAsignaturasQuery(new PaginarAsignaturasDTO('busqueda', 15))
        );

        $items = $result->items();

        $this->assertSame('Cálculo', $items[0]->nombre());
        $this->assertSame('Exactas', $items[0]->facultadNombre());
        $this->assertSame('Salud', $items[1]->facultadNombre());
    }

    public function test_it_returns_empty_collection_when_repository_has_no_results(): void
    {
        $asignaturasRepo = Mockery::mock(AsignaturaRepository::class);
        $facultadesRepo = Mockery::mock(FacultadRepository::class);

        $asignaturasRepo->shouldReceive('paginate')
            ->once()
            ->with('', 25)
            ->andReturn(new LengthAwarePaginator(new Collection(), 0, 25));

        $facultadesRepo->shouldReceive('allOrdered')
            ->once()
            ->andReturn([]);

        $handler = new PaginarAsignaturasHandler($asignaturasRepo, $facultadesRepo);

        $result = $handler->handle(new PaginarAsignaturasQuery(new PaginarAsignaturasDTO('', 25)));

        $this->assertSame([], $result->items());
    }
}
