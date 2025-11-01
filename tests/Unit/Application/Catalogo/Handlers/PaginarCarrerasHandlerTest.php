<?php

namespace Tests\Unit\Application\Catalogo\Handlers;

use App\Application\Catalogo\DTOs\PaginarCarrerasDTO;
use App\Application\Catalogo\Handlers\PaginarCarrerasHandler;
use App\Application\Catalogo\Queries\PaginarCarrerasQuery;
use App\Domain\Catalogo\Entities\Carrera;
use App\Domain\Catalogo\Entities\Facultad;
use App\Domain\Catalogo\Repositories\CarreraRepository;
use App\Domain\Catalogo\Repositories\FacultadRepository;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

final class PaginarCarrerasHandlerTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    public function test_it_maps_carreras_with_facultad_names(): void
    {
        $carreraRepository = Mockery::mock(CarreraRepository::class);
        $facultadRepository = Mockery::mock(FacultadRepository::class);

        $carreras = new Collection([
            Carrera::reconstruir(1, 'Ingeniería', 2),
            Carrera::reconstruir(2, 'Medicina', 3),
        ]);

        $paginator = new LengthAwarePaginator($carreras, $carreras->count(), 10);

        $carreraRepository->shouldReceive('paginate')
            ->once()
            ->with(10)
            ->andReturn($paginator);

        $facultades = [
            Facultad::reconstruir(2, 'Ciencias'),
            Facultad::reconstruir(3, 'Salud'),
        ];

        $facultadRepository->shouldReceive('allOrdered')
            ->once()
            ->andReturn($facultades);

        $handler = new PaginarCarrerasHandler($carreraRepository, $facultadRepository);

        $result = $handler->handle(
            new PaginarCarrerasQuery(new PaginarCarrerasDTO(10))
        );

        $items = $result->items();

        $this->assertCount(2, $items);
        $this->assertSame('Ingeniería', $items[0]->nombre());
        $this->assertSame('Ciencias', $items[0]->facultadNombre());
        $this->assertSame('Salud', $items[1]->facultadNombre());
    }

    public function test_it_returns_empty_collection_when_no_carreras_exist(): void
    {
        $carreraRepository = Mockery::mock(CarreraRepository::class);
        $facultadRepository = Mockery::mock(FacultadRepository::class);

        $carreraRepository->shouldReceive('paginate')
            ->once()
            ->with(20)
            ->andReturn(new LengthAwarePaginator(new Collection(), 0, 20));

        $facultadRepository->shouldReceive('allOrdered')
            ->once()
            ->andReturn([]);

        $handler = new PaginarCarrerasHandler($carreraRepository, $facultadRepository);

        $result = $handler->handle(new PaginarCarrerasQuery(new PaginarCarrerasDTO(20)));

        $this->assertSame([], $result->items());
    }
}
