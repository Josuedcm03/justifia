<?php

namespace Tests\Unit\Application\Catalogo\Handlers;

use App\Application\Catalogo\Commands\CrearCarreraCommand;
use App\Application\Catalogo\DTOs\CrearCarreraDTO;
use App\Application\Catalogo\Handlers\CrearCarreraHandler;
use App\Domain\Catalogo\Entities\Carrera;
use App\Domain\Catalogo\Repositories\CarreraRepository;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

final class CrearCarreraHandlerTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    public function test_it_persists_new_carrera(): void
    {
        $repository = Mockery::mock(CarreraRepository::class);

        $expected = Carrera::reconstruir(5, 'Arquitectura', 9);

        $repository->shouldReceive('create')
            ->once()
            ->with(Mockery::on(function ($entity) {
                return $entity instanceof Carrera
                    && $entity->nombre()->value() === 'Arquitectura'
                    && $entity->facultadId()->value() === 9;
            }))
            ->andReturn($expected);

        $handler = new CrearCarreraHandler($repository);

        $result = $handler->handle(
            new CrearCarreraCommand(new CrearCarreraDTO('Arquitectura', 9))
        );

        $this->assertSame($expected, $result);
    }
}
