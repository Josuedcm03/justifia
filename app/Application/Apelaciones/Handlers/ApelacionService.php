<?php

namespace App\Application\Apelaciones\Handlers;

use App\Application\Apelaciones\Commands\ActualizarApelacionCommand;
use App\Application\Apelaciones\Commands\CrearApelacionCommand;
use App\Application\Apelaciones\Queries\ListarApelacionesPorEstudianteQuery;
use App\Application\Apelaciones\Queries\ObtenerApelacionPorIdQuery;
use App\Application\Apelaciones\Queries\ObtenerUltimaApelacionDeSolicitudQuery;
use App\Application\Apelaciones\Queries\ObtenerUltimaApelacionRechazadaQuery;
use App\Application\Apelaciones\Queries\PaginarApelacionesPorEstadoQuery;
use App\Domain\Apelaciones\Entities\Apelacion as ApelacionEntity;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;
use App\Domain\Shared\Enums\EstadoApelacion;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use InvalidArgumentException;

class ApelacionService
{
    public function __construct(private readonly ApelacionRepository $apelaciones)
    {
    }

    /** @return iterable<Apelacion> */
    public function listarFinalesPorEstudiante(ListarApelacionesPorEstudianteQuery $query): iterable
    {
        return $this->apelaciones->listarFinalesPorEstudiante($query->estudianteId());
    }

    public function obtenerUltimaDeSolicitud(ObtenerUltimaApelacionDeSolicitudQuery $query): ?ApelacionEntity
    {
        return $this->apelaciones->obtenerUltimaPorSolicitud($query->solicitudId());
    }

    public function obtenerUltimaRechazada(ObtenerUltimaApelacionRechazadaQuery $query): ?ApelacionEntity
    {
        return $this->apelaciones->obtenerUltimaRechazada($query->solicitudId());
    }

    public function obtenerPorId(ObtenerApelacionPorIdQuery $query): ApelacionEntity
    {
        return $this->apelaciones->findById($query->apelacionId());
    }

    public function crear(CrearApelacionCommand $command): ApelacionEntity
    {
        $observacion = $this->requireTexto($command->observacion());
        $solicitudId = $this->requireInt($command->solicitudId(), 'solicitud_id');
        $apelacionPadreId = $command->apelacionPadreId() !== null
            ? $this->requireInt($command->apelacionPadreId(), 'apelacion_id')
            : null;

        $entity = ApelacionEntity::crear($observacion, $solicitudId, $apelacionPadreId);

        return $this->apelaciones->crear($entity);
    }

    public function actualizar(ActualizarApelacionCommand $command): ApelacionEntity
    {
        $apelacion = $this->apelaciones->findById($command->apelacionId());
        $estado = $command->estado() ?? $apelacion->estado();

        if ($estado === EstadoApelacion::Pendiente) {
            $apelacion->dejarPendiente();
        } else {
            $respuesta = $this->requireTexto($command->respuesta());
            $apelacion->registrarRespuesta($respuesta, $estado);
        }

        return $this->apelaciones->actualizar($apelacion);
    }

    public function paginarPorEstado(PaginarApelacionesPorEstadoQuery $query): LengthAwarePaginator
    {
        return $this->apelaciones->paginarPorEstado($query->estado(), $query->perPage());
    }

    private function requireInt(?int $valor, string $key): int
    {
        if ($valor === null) {
            throw new InvalidArgumentException(sprintf('El campo %s es obligatorio.', $key));
        }

        if ($valor <= 0) {
            throw new InvalidArgumentException(sprintf('El campo %s debe ser un entero positivo.', $key));
        }

        return $valor;
    }

    private function requireTexto(?string $texto): string
    {
        $texto = $texto !== null ? trim($texto) : '';
        if ($texto === '') {
            throw new InvalidArgumentException('El texto es obligatorio.');
        }

        return $texto;
    }
}
