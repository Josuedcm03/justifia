<?php

namespace App\Application\Reprogramaciones\Handlers;

use App\Application\Solicitudes\Handlers\SolicitudService;
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

    public function obtenerPorId(int $id): ReprogramacionEntity
    {
        return $this->reprogramaciones->findById($id);
    }

    public function obtenerSolicitudPorId(int $id): SolicitudEntity
    {
        return $this->solicitudes->obtenerPorId($id);
    }

    public function crear(SolicitudEntity $solicitud, array $data): ReprogramacionEntity
    {
        $fecha = $this->parseFecha($data['fecha'] ?? null);
        $hora = $this->requireHora($data['hora'] ?? null);

        $entity = ReprogramacionEntity::crear(
            $fecha,
            $hora,
            $data['observaciones'] ?? null,
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

    public function actualizar(ReprogramacionEntity $reprogramacion, array $data): ReprogramacionEntity
    {
        if (array_key_exists('fecha', $data) || array_key_exists('hora', $data) || array_key_exists('observaciones', $data)) {
            $fecha = $this->parseFecha($data['fecha'] ?? $reprogramacion->fecha()->format('Y-m-d'));
            $hora = $this->requireHora($data['hora'] ?? $reprogramacion->hora()->value());
            $observaciones = $data['observaciones'] ?? $reprogramacion->observaciones()?->value();
            $reprogramacion->reprogramar($fecha, $hora, $observaciones);
        }

        if (array_key_exists('asistencia', $data) && $data['asistencia'] !== null) {
            $estado = $data['asistencia'] instanceof EstadoAsistencia
                ? $data['asistencia']
                : EstadoAsistencia::from($data['asistencia']);
            $reprogramacion->registrarAsistencia($estado);
        }

        return $this->reprogramaciones->update($reprogramacion);
    }

    public function solicitudesAprobadasSinReprogramar(int $docenteId)
    {
        return $this->solicitudes->solicitudesAprobadasSinReprogramar($docenteId);
    }

    public function reprogramacionesPorDocente(int $docenteId)
    {
        return $this->solicitudes->reprogramacionesPorDocente($docenteId);
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
