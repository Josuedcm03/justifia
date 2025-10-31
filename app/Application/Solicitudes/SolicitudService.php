<?php

namespace App\Application\Solicitudes;

use App\Domain\Shared\ValueObjects\ArchivoConstancia;
use App\Domain\Solicitud\Entities\Solicitud as SolicitudEntity;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use App\Enums\EstadoSolicitud;
use App\Mail\ApprovalMail;
use App\Mail\RejectionMail;
use App\Models\ModuloEstudiante\Solicitud as SolicitudModel;
use DateTimeImmutable;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;

class SolicitudService
{
    public function __construct(
        private readonly SolicitudRepository $solicitudes,
        private readonly Filesystem $publicStorage
    ) {
    }

    public function paginateForEstudiante(int $estudianteId, EstadoSolicitud $estado, int $perPage = 9): LengthAwarePaginator
    {
        return $this->solicitudes->paginateByEstadoForEstudiante($estudianteId, $estado, $perPage);
    }

    public function paginateForSecretaria(EstadoSolicitud $estado, bool $sinApelacionesPendientes, int $perPage = 9): LengthAwarePaginator
    {
        return $this->solicitudes->paginateByEstadoForSecretaria($estado, $sinApelacionesPendientes, $perPage);
    }

    public function crear(array $data, ?UploadedFile $constancia, int $estudianteId): SolicitudModel
    {
        $fechaAusencia = $this->parseFecha($data['fecha_ausencia'] ?? null);
        $docenteId = $this->requireInt($data, 'docente_id');
        $asignaturaId = $this->requireInt($data, 'asignatura_id');
        $tipoConstanciaId = $this->requireInt($data, 'tipo_constancia_id');

        $rutaConstancia = null;
        if ($constancia) {
            $rutaConstancia = $this->publicStorage->putFile('constancias', $constancia);
        }

        $entity = SolicitudEntity::crearNueva(
            $fechaAusencia,
            $rutaConstancia ? ArchivoConstancia::fromPath($rutaConstancia) : null,
            $data['observaciones'] ?? '',
            $estudianteId,
            $docenteId,
            $asignaturaId,
            $tipoConstanciaId
        );

        return $this->solicitudes->create($entity->payloadParaCreacion());
    }

    public function actualizar(
        SolicitudModel $solicitud,
        array $data,
        ?UploadedFile $constancia = null,
        bool $eliminarConstancia = false
    ): SolicitudModel {
        $entity = SolicitudEntity::reconstruir(
            $solicitud->id,
            $this->parseFecha($this->fechaString($solicitud->fecha_ausencia)),
            ArchivoConstancia::fromNullable($solicitud->constancia),
            $solicitud->observaciones ?? '',
            $solicitud->respuesta,
            $solicitud->estado,
            $solicitud->estudiante_id,
            $solicitud->docente_id,
            $solicitud->asignatura_id,
            $solicitud->tipo_constancia_id
        );

        $fechaAusencia = $this->parseFecha($data['fecha_ausencia'] ?? $this->fechaString($solicitud->fecha_ausencia));
        $docenteId = $this->requireInt($data, 'docente_id', $solicitud->docente_id);
        $asignaturaId = $this->requireInt($data, 'asignatura_id', $solicitud->asignatura_id);
        $tipoConstanciaId = $this->requireInt($data, 'tipo_constancia_id', $solicitud->tipo_constancia_id);

        $entity->actualizarDatos(
            $fechaAusencia,
            $data['observaciones'] ?? ($solicitud->observaciones ?? ''),
            $docenteId,
            $asignaturaId,
            $tipoConstanciaId
        );

        if ($constancia) {
            $this->eliminarConstancia($solicitud);
            $rutaConstancia = $this->publicStorage->putFile('constancias', $constancia);
            $entity->adjuntarConstancia(ArchivoConstancia::fromPath($rutaConstancia));
        } elseif ($eliminarConstancia) {
            $this->eliminarConstancia($solicitud);
            $entity->eliminarConstancia();
        }

        return $this->solicitudes->update($solicitud, $entity->payloadParaActualizacion());
    }

    public function eliminar(SolicitudModel $solicitud): void
    {
        $this->eliminarConstancia($solicitud);
        $this->solicitudes->delete($solicitud);
    }

    public function actualizarEstado(SolicitudModel $solicitud, EstadoSolicitud $estado, ?string $respuesta): SolicitudModel
    {
        $entity = SolicitudEntity::reconstruir(
            $solicitud->id,
            $this->parseFecha($this->fechaString($solicitud->fecha_ausencia)),
            ArchivoConstancia::fromNullable($solicitud->constancia),
            $solicitud->observaciones ?? '',
            $solicitud->respuesta,
            $solicitud->estado,
            $solicitud->estudiante_id,
            $solicitud->docente_id,
            $solicitud->asignatura_id,
            $solicitud->tipo_constancia_id
        );

        $entity->actualizarEstado($estado, $respuesta);

        $solicitud = $this->solicitudes->update($solicitud, $entity->payloadParaCambioEstado());

        $studentUser = $solicitud->estudiante->usuario;
        $teacherUser = $solicitud->docente->usuario;

        if ($estado === EstadoSolicitud::Aprobada) {
            Mail::to($studentUser->email)->queue(new ApprovalMail($studentUser->name, $solicitud, $studentUser->email));
            Mail::to($teacherUser->email)->queue(new ApprovalMail($teacherUser->name, $solicitud, $teacherUser->email));
        }

        if ($estado === EstadoSolicitud::Rechazada) {
            Mail::to($studentUser->email)->queue(new RejectionMail($studentUser->name, $solicitud, $studentUser->email));
            Mail::to($teacherUser->email)->queue(new RejectionMail($teacherUser->name, $solicitud, $teacherUser->email));
        }

        return $solicitud;
    }

    /** @return iterable<Solicitud> */
    public function solicitudesAprobadasSinReprogramar(int $docenteId)
    {
        return $this->solicitudes->solicitudesAprobadasSinReprogramacion($docenteId);
    }

    /** @return iterable<Solicitud> */
    public function reprogramacionesPorDocente(int $docenteId)
    {
        return $this->solicitudes->reprogramacionesPorDocente($docenteId);
    }

    private function eliminarConstancia(SolicitudModel $solicitud): void
    {
        if ($solicitud->constancia && $this->publicStorage->exists($solicitud->constancia)) {
            $this->publicStorage->delete($solicitud->constancia);
        }
    }

    private function parseFecha(?string $fecha): DateTimeImmutable
    {
        if (! $fecha) {
            throw new InvalidArgumentException('La fecha de ausencia es obligatoria.');
        }

        $instancia = DateTimeImmutable::createFromFormat('Y-m-d', $fecha);
        if (! $instancia) {
            throw new InvalidArgumentException('La fecha de ausencia no tiene un formato válido.');
        }

        return $instancia;
    }

    private function requireInt(array $data, string $key, ?int $default = null): int
    {
        $valor = $data[$key] ?? $default;

        if ($valor === null) {
            throw new InvalidArgumentException(sprintf('El campo %s es obligatorio.', $key));
        }

        if (! is_numeric($valor)) {
            throw new InvalidArgumentException(sprintf('El campo %s debe ser numérico.', $key));
        }

        $intValor = (int) $valor;

        if ($intValor <= 0) {
            throw new InvalidArgumentException(sprintf('El campo %s debe ser un entero positivo.', $key));
        }

        return $intValor;
    }

    private function fechaString(mixed $valor): string
    {
        if ($valor instanceof \DateTimeInterface) {
            return $valor->format('Y-m-d');
        }

        return (string) $valor;
    }
}
