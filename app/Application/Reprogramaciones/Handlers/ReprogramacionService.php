<?php

namespace App\Application\Reprogramaciones\Handlers;

use App\Application\Reprogramaciones\Commands\ActualizarReprogramacionCommand;
use App\Application\Reprogramaciones\Commands\CrearReprogramacionCommand;
use App\Application\Reprogramaciones\Queries\ObtenerReprogramacionPorIdQuery;
use App\Application\Reprogramaciones\Queries\ReprogramacionesPorDocenteQuery;
use App\Application\Reprogramaciones\Queries\SolicitudesAprobadasSinReprogramarQuery;
use App\Application\Solicitudes\DTOs\SolicitudIdDTO;
use App\Application\Solicitudes\DTOs\SolicitudesDocenteDTO;
use App\Application\Solicitudes\Handlers\SolicitudService;
use App\Application\Solicitudes\Queries\ObtenerSolicitudPorIdQuery;
use App\Application\Solicitudes\Queries\ReprogramacionesPorDocenteQuery as SolicitudesReprogramacionesPorDocenteQuery;
use App\Application\Solicitudes\Queries\SolicitudesAprobadasSinReprogramarQuery as SolicitudesSolicitudesAprobadasSinReprogramarQuery;
use App\Domain\Reprogramacion\Entities\Reprogramacion as ReprogramacionEntity;
use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;
use App\Domain\Solicitud\Entities\Solicitud as SolicitudEntity;
use App\Domain\Shared\Enums\EstadoAsistencia;
use App\Mail\RescheduleMail;
use App\Models\ModuloEstudiante\Solicitud as SolicitudModel;
use DateTimeImmutable;
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;

class ReprogramacionService
{
    public function __construct(
        private readonly ReprogramacionRepository $reprogramaciones,
        private readonly SolicitudService $solicitudes
    ) {
    }

    public function obtenerPorId(ObtenerReprogramacionPorIdQuery $query): ReprogramacionEntity
    {
        return $this->reprogramaciones->findById($query->reprogramacionId());
    }

    public function obtenerSolicitudPorId(ObtenerSolicitudPorIdQuery $query): SolicitudEntity
    {
        return $this->solicitudes->obtenerPorId($query);
    }

    public function crear(CrearReprogramacionCommand $command): ReprogramacionEntity
    {
        $solicitud = $this->solicitudes->obtenerPorId(
            new ObtenerSolicitudPorIdQuery(new SolicitudIdDTO($command->solicitudId()))
        );

        $fecha = $this->parseFecha($command->fecha());
        $hora = $this->requireHora($command->hora());

        $entity = ReprogramacionEntity::crear(
            $fecha,
            $hora,
            $command->observaciones(),
            $solicitud->id()?->value() ?? throw new InvalidArgumentException('La solicitud debe existir para reprogramar.')
        );

        $reprogramacion = $this->reprogramaciones->create($entity);

        $solicitudModel = SolicitudModel::with('estudiante.usuario')->find($solicitud->id()?->value());

        if ($solicitudModel) {
            $studentUser = $solicitudModel->estudiante->usuario;

            Mail::to($studentUser->email)->queue(new RescheduleMail(
                $studentUser->name,
                \Carbon\Carbon::parse($reprogramacion->fecha()->format('Y-m-d'))->format('d-m-Y'),
                $reprogramacion->hora()->value(),
                $reprogramacion->observaciones()?->value(),
                $studentUser->email
            ));
        }

        return $reprogramacion;
    }

    public function actualizar(ActualizarReprogramacionCommand $command): ReprogramacionEntity
    {
        $reprogramacion = $this->reprogramaciones->findById($command->reprogramacionId());

        if ($command->fecha() !== null || $command->hora() !== null || $command->observaciones() !== null) {
            $fecha = $this->parseFecha($command->fecha() ?? $reprogramacion->fecha()->format('Y-m-d'));
            $hora = $this->requireHora($command->hora() ?? $reprogramacion->hora()->value());
            $observaciones = $command->observaciones() ?? $reprogramacion->observaciones()?->value();
            $reprogramacion->reprogramar($fecha, $hora, $observaciones);
        }

        if ($command->asistencia() !== null) {
            $reprogramacion->registrarAsistencia($command->asistencia());
        }

        return $this->reprogramaciones->update($reprogramacion);
    }

    public function solicitudesAprobadasSinReprogramar(SolicitudesAprobadasSinReprogramarQuery $query)
    {
        return $this->solicitudes->solicitudesAprobadasSinReprogramar(
            new SolicitudesSolicitudesAprobadasSinReprogramarQuery(new SolicitudesDocenteDTO($query->docenteId()))
        );
    }

    public function reprogramacionesPorDocente(ReprogramacionesPorDocenteQuery $query)
    {
        return $this->solicitudes->reprogramacionesPorDocente(
            new SolicitudesReprogramacionesPorDocenteQuery(new SolicitudesDocenteDTO($query->docenteId()))
        );
    }

    private function parseFecha(?string $fecha): DateTimeImmutable
    {
        if (! $fecha) {
            throw new InvalidArgumentException('La fecha es obligatoria.');
        }

        $instancia = DateTimeImmutable::createFromFormat('Y-m-d', $fecha);
        if (! $instancia) {
            throw new InvalidArgumentException('La fecha no tiene un formato válido.');
        }

        return $instancia;
    }

    private function requireHora(?string $hora): string
    {
        $hora = $hora !== null ? trim($hora) : '';
        if ($hora === '') {
            throw new InvalidArgumentException('La hora es obligatoria.');
        }

        $validada = DateTimeImmutable::createFromFormat('H:i', $hora);
        if (! $validada || $validada->format('H:i') !== $hora) {
            throw new InvalidArgumentException('La hora debe tener el formato HH:MM.');
        }

        return $hora;
    }

    private function fechaString(mixed $valor): string
    {
        if ($valor instanceof \DateTimeInterface) {
            return $valor->format('Y-m-d');
        }

        return (string) $valor;
    }
}
