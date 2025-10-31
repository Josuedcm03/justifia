<?php

namespace App\Application\Solicitudes;

use App\Domain\Shared\ValueObjects\ArchivoConstancia;
use App\Domain\Solicitud\Entities\Solicitud as SolicitudEntity;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use App\Domain\Shared\Enums\EstadoSolicitud;
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

    public function obtenerPorId(int $id): SolicitudEntity
    {
        return $this->solicitudes->findById($id);
    }

    public function crear(array $data, ?UploadedFile $constancia, int $estudianteId): SolicitudEntity
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

        return $this->solicitudes->create($entity);
    }

    public function actualizar(
        SolicitudEntity $solicitud,
        array $data,
        ?UploadedFile $constancia = null,
        bool $eliminarConstancia = false
    ): SolicitudEntity {
        $fechaAusencia = $this->parseFecha($data['fecha_ausencia'] ?? $solicitud->fechaAusencia()->format('Y-m-d'));
        $docenteId = $this->requireInt($data, 'docente_id', $solicitud->docenteId()->value());
        $asignaturaId = $this->requireInt($data, 'asignatura_id', $solicitud->asignaturaId()->value());
        $tipoConstanciaId = $this->requireInt($data, 'tipo_constancia_id', $solicitud->tipoConstanciaId()->value());

        $solicitud->actualizarDatos(
            $fechaAusencia,
            $data['observaciones'] ?? $solicitud->observaciones()->value(),
            $docenteId,
            $asignaturaId,
            $tipoConstanciaId
        );

        $constanciaAnterior = $solicitud->constancia();

        if ($constancia) {
            $rutaConstancia = $this->publicStorage->putFile('constancias', $constancia);
            $solicitud->adjuntarConstancia(ArchivoConstancia::fromPath($rutaConstancia));
            $this->eliminarConstanciaPath($constanciaAnterior?->path());
        } elseif ($eliminarConstancia) {
            $solicitud->eliminarConstancia();
            $this->eliminarConstanciaPath($constanciaAnterior?->path());
        }

        return $this->solicitudes->update($solicitud);
    }

    public function eliminar(SolicitudEntity $solicitud): void
    {
        $this->eliminarConstanciaPath($solicitud->constancia()?->path());
        $this->solicitudes->delete($solicitud);
    }

    public function actualizarEstado(SolicitudEntity $solicitud, EstadoSolicitud $estado, ?string $respuesta): SolicitudEntity
    {
        $solicitud->actualizarEstado($estado, $respuesta);

        $solicitudActualizada = $this->solicitudes->update($solicitud);

        $this->notificarCambioEstado($solicitudActualizada);

        return $solicitudActualizada;
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

    private function eliminarConstanciaPath(?string $path): void
    {
        if ($path && $this->publicStorage->exists($path)) {
            $this->publicStorage->delete($path);
        }
    }

    private function notificarCambioEstado(SolicitudEntity $solicitud): void
    {
        $solicitudModel = SolicitudModel::with(['estudiante.usuario', 'docente.usuario'])->find($solicitud->id()?->value());

        if (! $solicitudModel) {
            return;
        }

        $studentUser = $solicitudModel->estudiante->usuario;
        $teacherUser = $solicitudModel->docente->usuario;

        if ($solicitud->estado() === EstadoSolicitud::Aprobada) {
            Mail::to($studentUser->email)->queue(new ApprovalMail($studentUser->name, $solicitudModel, $studentUser->email));
            Mail::to($teacherUser->email)->queue(new ApprovalMail($teacherUser->name, $solicitudModel, $teacherUser->email));
        }

        if ($solicitud->estado() === EstadoSolicitud::Rechazada) {
            Mail::to($studentUser->email)->queue(new RejectionMail($studentUser->name, $solicitudModel, $studentUser->email));
            Mail::to($teacherUser->email)->queue(new RejectionMail($teacherUser->name, $solicitudModel, $teacherUser->email));
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
