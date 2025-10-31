<?php

namespace App\Application\Apelaciones;

use App\Domain\Apelaciones\Entities\Apelacion as ApelacionEntity;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;
use App\Enums\EstadoApelacion;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use InvalidArgumentException;

class ApelacionService
{
    public function __construct(private readonly ApelacionRepository $apelaciones)
    {
    }

    /** @return iterable<Apelacion> */
    public function listarFinalesPorEstudiante(int $estudianteId): iterable
    {
        return $this->apelaciones->listarFinalesPorEstudiante($estudianteId);
    }

    public function obtenerUltimaDeSolicitud(int $solicitudId): ?ApelacionEntity
    {
        return $this->apelaciones->obtenerUltimaPorSolicitud($solicitudId);
    }

    public function obtenerUltimaRechazada(int $solicitudId): ?ApelacionEntity
    {
        return $this->apelaciones->obtenerUltimaRechazada($solicitudId);
    }

    public function obtenerPorId(int $id): ApelacionEntity
    {
        return $this->apelaciones->findById($id);
    }

    public function crear(array $data): ApelacionEntity
    {
        $observacion = $this->requireTexto($data['observacion'] ?? null);
        $solicitudId = $this->requireInt($data, 'solicitud_id');
        $apelacionPadreId = isset($data['apelacion_id']) && $data['apelacion_id'] !== null
            ? $this->requireInt($data, 'apelacion_id')
            : null;

        $entity = ApelacionEntity::crear($observacion, $solicitudId, $apelacionPadreId);

        return $this->apelaciones->crear($entity);
    }

    public function actualizar(ApelacionEntity $apelacion, array $data): ApelacionEntity
    {
        $estado = $data['estado'] ?? $apelacion->estado();
        if (! $estado instanceof EstadoApelacion) {
            $estado = EstadoApelacion::from($estado);
        }

        if ($estado === EstadoApelacion::Pendiente) {
            $apelacion->dejarPendiente();
        } else {
            $respuesta = $this->requireTexto($data['respuesta'] ?? null);
            $apelacion->registrarRespuesta($respuesta, $estado);
        }

        return $this->apelaciones->actualizar($apelacion);
    }

    public function paginarPorEstado(EstadoApelacion $estado, int $perPage = 9): LengthAwarePaginator
    {
        return $this->apelaciones->paginarPorEstado($estado, $perPage);
    }

    private function requireInt(array $data, string $key): int
    {
        $valor = $data[$key] ?? null;

        if ($valor === null) {
            throw new InvalidArgumentException(sprintf('El campo %s es obligatorio.', $key));
        }

        if (! is_numeric($valor)) {
            throw new InvalidArgumentException(sprintf('El campo %s debe ser numérico.', $key));
        }

        return (int) $valor;
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
