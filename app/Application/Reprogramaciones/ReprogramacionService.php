<?php

namespace App\Application\Reprogramaciones;

use App\Application\Solicitudes\SolicitudService;
use App\Domain\Reprogramacion\Entities\Reprogramacion;
use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;
use App\Domain\Solicitud\Entities\Solicitud;
use App\Enums\EstadoAsistencia;
use App\Mail\RescheduleMail;
use Illuminate\Support\Facades\Mail;

class ReprogramacionService
{
    public function __construct(
        private readonly ReprogramacionRepository $reprogramaciones,
        private readonly SolicitudService $solicitudes
    ) {
    }

    public function crear(Solicitud $solicitud, array $data): Reprogramacion
    {
        $reprogramacion = $this->reprogramaciones->create([
            'fecha' => $data['fecha'],
            'hora' => $data['hora'],
            'observaciones' => $data['observaciones'] ?? null,
            'solicitud_id' => $solicitud->id,
        ]);

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

    public function actualizar(Reprogramacion $reprogramacion, array $data): Reprogramacion
    {
        if (isset($data['asistencia'])) {
            $data['asistencia'] = EstadoAsistencia::from($data['asistencia']);
        }

        return $this->reprogramaciones->update($reprogramacion, $data);
    }

    public function solicitudesAprobadasSinReprogramar(int $docenteId)
    {
        return $this->solicitudes->solicitudesAprobadasSinReprogramar($docenteId);
    }

    public function reprogramacionesPorDocente(int $docenteId)
    {
        return $this->solicitudes->reprogramacionesPorDocente($docenteId);
    }
}