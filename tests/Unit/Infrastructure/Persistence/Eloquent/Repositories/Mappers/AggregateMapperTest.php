<?php

namespace Tests\Unit\Infrastructure\Persistence\Eloquent\Repositories\Mappers;

use App\Domain\Shared\Contracts\Entity;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\ApelacionMapper;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\AsignaturaMapper;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\DocenteMapper;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\FacultadMapper;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\ReprogramacionMapper;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\SolicitudMapper;
use App\Infraestructure\Persistence\Eloquent\Repositories\Mappers\TipoConstanciaMapper;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class AggregateMapperTest extends TestCase
{
    /**
     * @return array<string, array{0: class-string, 1: class-string}>
     */
    public static function mapperProvider(): array
    {
        return [
            'apelacion' => [ApelacionMapper::class, \App\Models\ModuloEstudiante\Apelacion::class],
            'asignatura' => [AsignaturaMapper::class, \App\Models\ModuloSecretaria\Asignatura::class],
            'docente' => [DocenteMapper::class, \App\Models\ModuloSecretaria\Docente::class],
            'facultad' => [FacultadMapper::class, \App\Models\ModuloSecretaria\Facultad::class],
            'reprogramacion' => [ReprogramacionMapper::class, \App\Models\ModuloDocente\Reprogramacion::class],
            'solicitud' => [SolicitudMapper::class, \App\Models\ModuloEstudiante\Solicitud::class],
            'tipo constancia' => [TipoConstanciaMapper::class, \App\Models\ModuloSecretaria\TipoConstancia::class],
        ];
    }

    /**
     * @dataProvider mapperProvider
     */
    public function test_to_entity_returns_same_instance(string $mapperClass, string $modelClass): void
    {
        $mapper = new $mapperClass();
        $model = new $modelClass();

        $entity = $mapper->toEntity($model);

        $this->assertSame($model, $entity);
    }

    /**
     * @dataProvider mapperProvider
     */
    public function test_to_model_returns_same_instance(string $mapperClass, string $modelClass): void
    {
        $mapper = new $mapperClass();
        $entity = new $modelClass();

        $model = $mapper->toModel($entity);

        $this->assertSame($entity, $model);
    }

    public function test_to_entity_throws_when_model_does_not_match_expected_type(): void
    {
        $mapper = new SolicitudMapper();

        $this->expectException(InvalidArgumentException::class);

        $mapper->toEntity(new class extends Model {
        });
    }

    public function test_to_model_throws_when_entity_does_not_match_expected_type(): void
    {
        $mapper = new SolicitudMapper();

        $this->expectException(InvalidArgumentException::class);

        $mapper->toModel(new class implements Entity {
        });
    }
}
