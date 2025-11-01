<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Solicitudes\Commands\ActualizarEstadoSolicitudCommand;
use App\Application\Solicitudes\Commands\ActualizarSolicitudCommand;
use App\Application\Solicitudes\Commands\CrearSolicitudCommand;
use App\Application\Solicitudes\Commands\EliminarSolicitudCommand;
use App\Application\Solicitudes\Queries\ObtenerSolicitudPorIdQuery;
use App\Application\Solicitudes\Queries\PaginarSolicitudesEstudianteQuery;
use App\Application\Solicitudes\Queries\PaginarSolicitudesSecretariaQuery;
use App\Application\Solicitudes\Queries\ReprogramacionesPorDocenteQuery;
use App\Application\Solicitudes\Queries\SolicitudesAprobadasSinReprogramarQuery;
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
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;

class SolicitudService
{
    public function __construct(
        private readonly SolicitudRepository $solicitudes,
        private readonly Filesystem $publicStorage
    ) {
    }

    public function paginateForEstudiante(PaginarSolicitudesEstudianteQuery $query): LengthAwarePaginator
    {
        return $this->solicitudes->paginateByEstadoForEstudiante(
            $query->estudianteId(),
            $query->estado(),
            $query->perPage()
        );
    }

    public function paginateForSecretaria(PaginarSolicitudesSecretariaQuery $query): LengthAwarePaginator
    {
        return $this->solicitudes->paginateByEstadoForSecretaria(
            $query->estado(),
            $query->sinApelacionesPendientes(),
            $query->perPage()
        );
    }

    public function obtenerPorId(ObtenerSolicitudPorIdQuery $query): SolicitudEntity
    {
        return $this->solicitudes->findById($query->solicitudId());
    }

    public function crear(CrearSolicitudCommand $command): SolicitudEntity
    {
        $fechaAusencia = $this->parseFecha($command->fechaAusencia());
        $docenteId = $this->requirePositiveInt($command->docenteId(), 'docente_id');
        $asignaturaId = $this->requirePositiveInt($command->asignaturaId(), 'asignatura_id');
        $tipoConstanciaId = $this->requirePositiveInt($command->tipoConstanciaId(), 'tipo_constancia_id');

        $rutaConstancia = null;
        $constancia = $command->constancia();
        if ($constancia) {
            $rutaConstancia = $this->publicStorage->putFile('constancias', $constancia);
        }

        $entity = SolicitudEntity::crearNueva(
            $fechaAusencia,
            $rutaConstancia ? ArchivoConstancia::fromPath($rutaConstancia) : null,
            $command->observaciones() ?? '',
            $this->requirePositiveInt($command->estudianteId(), 'estudiante_id'),
            $docenteId,
            $asignaturaId,
            $tipoConstanciaId
        );

        return $this->solicitudes->create($entity);
    }

    public function actualizar(ActualizarSolicitudCommand $command): SolicitudEntity
    {
        $solicitud = $this->solicitudes->findById($command->solicitudId());

        $fechaAusencia = $this->parseFecha($command->fechaAusencia());
        $docenteId = $this->requirePositiveInt($command->docenteId(), 'docente_id');
        $asignaturaId = $this->requirePositiveInt($command->asignaturaId(), 'asignatura_id');
        $tipoConstanciaId = $this->requirePositiveInt($command->tipoConstanciaId(), 'tipo_constancia_id');

        $solicitud->actualizarDatos(
            $fechaAusencia,
            $command->observaciones() ?? $solicitud->observaciones()->value(),
            $docenteId,
            $asignaturaId,
            $tipoConstanciaId
        );

        $constanciaAnterior = $solicitud->constancia();
        $constancia = $command->constancia();

        if ($constancia) {
            $rutaConstancia = $this->publicStorage->putFile('constancias', $constancia);
            $solicitud->adjuntarConstancia(ArchivoConstancia::fromPath($rutaConstancia));
            $this->eliminarConstanciaPath($constanciaAnterior?->path());
        } elseif ($command->eliminarConstancia()) {
            $solicitud->eliminarConstancia();
            $this->eliminarConstanciaPath($constanciaAnterior?->path());
        }

        return $this->solicitudes->update($solicitud);
    }

    public function eliminar(EliminarSolicitudCommand $command): void
    {
        $solicitud = $this->solicitudes->findById($command->solicitudId());

        $this->eliminarConstanciaPath($solicitud->constancia()?->path());
        $this->solicitudes->delete($solicitud);
    }

    public function actualizarEstado(ActualizarEstadoSolicitudCommand $command): SolicitudEntity
    {
        $solicitud = $this->solicitudes->findById($command->solicitudId());

        $solicitud->actualizarEstado($command->estado(), $command->respuesta());

        $solicitudActualizada = $this->solicitudes->update($solicitud);

        $this->notificarCambioEstado($solicitudActualizada);

        return $solicitudActualizada;
    }

    /** @return iterable<Solicitud> */
    public function solicitudesAprobadasSinReprogramar(SolicitudesAprobadasSinReprogramarQuery $query)
    {
        return $this->solicitudes->solicitudesAprobadasSinReprogramacion($query->docenteId());
    }

    /** @return iterable<Solicitud> */
    public function reprogramacionesPorDocente(ReprogramacionesPorDocenteQuery $query)
    {
        return $this->solicitudes->reprogramacionesPorDocente($query->docenteId());
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

    private function requirePositiveInt(int $valor, string $key): int
    {
        if ($valor <= 0) {
            throw new InvalidArgumentException(sprintf('El campo %s debe ser un entero positivo.', $key));
        }

        return $valor;
    }
}
