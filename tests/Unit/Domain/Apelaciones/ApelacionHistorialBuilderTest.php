<?php

namespace Tests\Unit\Domain\Apelaciones;

use App\Domain\Apelaciones\Tree\ApelacionHistorialBuilder;
use PHPUnit\Framework\TestCase;

final class ApelacionHistorialBuilderTest extends TestCase
{
    public function testBuildGeneratesChronologicalConversation(): void
    {
        $builder = new ApelacionHistorialBuilder();

        $historial = $builder->build('Respuesta inicial', [
            ['observacion' => 'Primera apelación', 'respuesta' => 'Primera respuesta'],
            ['observacion' => 'Segunda apelación', 'respuesta' => null],
            ['observacion' => 'Tercera apelación', 'respuesta' => 'Respuesta final'],
        ]);

        self::assertSame([
            ['autor' => 'secretaria', 'mensaje' => 'Respuesta inicial'],
            ['autor' => 'estudiante', 'mensaje' => 'Primera apelación'],
            ['autor' => 'secretaria', 'mensaje' => 'Primera respuesta'],
            ['autor' => 'estudiante', 'mensaje' => 'Segunda apelación'],
            ['autor' => 'estudiante', 'mensaje' => 'Tercera apelación'],
            ['autor' => 'secretaria', 'mensaje' => 'Respuesta final'],
        ], $historial);
    }
}
