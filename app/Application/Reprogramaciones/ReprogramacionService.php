<?php

namespace App\Application\Reprogramaciones;

use App\Application\Solicitudes\SolicitudService;
use App\Domain\Reprogramacion\Entities\Reprogramacion as ReprogramacionEntity;
use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;
use App\Enums\EstadoAsistencia;
use App\Mail\RescheduleMail;
use App\Models\ModuloDocente\Reprogramacion as ReprogramacionModel;
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

    public function crear(SolicitudModel $solicitud, array $data): ReprogramacionModel
    {
        $fecha = $this->parseFecha($data['fecha'] ?? null);
        $hora = $this->requireHora($data['hora'] ?? null);

        $entity = ReprogramacionEntity::crear(
            $fecha,
            $hora,
            $data['observaciones'] ?? null,
            $solicitud->id
        );

        $reprogramacion = $this->reprogramaciones->create($entity->toArray());

        $studentUser = $solicitud->estudiante->usuario;

        Mail::to($studentUser->email)->queue(new RescheduleMail(
            $studentUser->name,
            \Carbon\Carbon::parse($reprogramacion->fecha)->format('d-m-Y'),
            $reprogramacion->hora,
            $reprogramacion->observaciones,
            $studentUser->email
        ));

        return $reprogramacion;
    }

    public function actualizar(ReprogramacionModel $reprogramacion, array $data): ReprogramacionModel
    {
        $entity = ReprogramacionEntity::reconstruir(
            $reprogramacion->id,
            $this->parseFecha($this->fechaString($reprogramacion->fecha)),
            $reprogramacion->hora,
            $reprogramacion->asistencia,
            $reprogramacion->observaciones,
            $reprogramacion->solicitud_id
        );

        if (array_key_exists('fecha', $data) || array_key_exists('hora', $data) || array_key_exists('observaciones', $data)) {
            $fecha = $this->parseFecha($data['fecha'] ?? $this->fechaString($reprogramacion->fecha));
            $hora = $this->requireHora($data['hora'] ?? $reprogramacion->hora);
            $observaciones = $data['observaciones'] ?? $reprogramacion->observaciones;
            $entity->reprogramar($fecha, $hora, $observaciones);
        }

        if (array_key_exists('asistencia', $data) && $data['asistencia'] !== null) {
            $estado = $data['asistencia'] instanceof EstadoAsistencia
                ? $data['asistencia']
                : EstadoAsistencia::from($data['asistencia']);
            $entity->registrarAsistencia($estado);
        }

        return $this->reprogramaciones->update($reprogramacion, $entity->toArray());
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
