<?php

namespace Tests\Unit\Application\Catalogo\Handlers;

use App\Application\Catalogo\Commands\EliminarTipoConstanciaCommand;
use App\Application\Catalogo\DTOs\TipoConstanciaIdDTO;
use App\Application\Catalogo\Handlers\EliminarTipoConstanciaHandler;
use App\Domain\Catalogo\Entities\TipoConstancia;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

final class EliminarTipoConstanciaHandlerTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    public function test_it_deletes_tipo_constancia(): void
    {
        $repository = Mockery::mock(TipoConstanciaRepository::class);

        $tipo = TipoConstancia::reconstruir(7, 'Certificado');

        $repository->shouldReceive('findById')
            ->once()
            ->with(7)
            ->andReturn($tipo);

        $repository->shouldReceive('delete')
            ->once()
            ->with($tipo);

        $handler = new EliminarTipoConstanciaHandler($repository);

        $handler->handle(
            new EliminarTipoConstanciaCommand(new TipoConstanciaIdDTO(7))
        );
    }
}
