<?php

namespace App\Application\Solicitudes;

use App\Domain\Solicitud\Repositories\SolicitudRepository;
use App\Enums\EstadoSolicitud;
use App\Mail\ApprovalMail;
use App\Mail\RejectionMail;
use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;

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

    public function crear(array $data, ?UploadedFile $constancia, int $estudianteId): Solicitud
    {
        if ($constancia) {
            $data['constancia'] = $this->publicStorage->putFile('constancias', $constancia);
        }

        $data['estado'] = EstadoSolicitud::Pendiente;
        $data['estudiante_id'] = $estudianteId;

        return $this->solicitudes->create($data);
    }

    public function actualizar(Solicitud $solicitud, array $data, ?UploadedFile $constancia = null, bool $eliminarConstancia = false): Solicitud
    {
        if ($constancia) {
            $this->eliminarConstancia($solicitud);
            $data['constancia'] = $this->publicStorage->putFile('constancias', $constancia);
        } elseif ($eliminarConstancia) {
            $this->eliminarConstancia($solicitud);
            $data['constancia'] = null;
        }

        return $this->solicitudes->update($solicitud, $data);
    }

    public function eliminar(Solicitud $solicitud): void
    {
        $this->eliminarConstancia($solicitud);
        $this->solicitudes->delete($solicitud);
    }

    public function actualizarEstado(Solicitud $solicitud, EstadoSolicitud $estado, ?string $respuesta): Solicitud
    {
        $solicitud = $this->solicitudes->update($solicitud, [
            'estado' => $estado,
            'respuesta' => $respuesta,
        ]);

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

    public function solicitudesAprobadasSinReprogramar(int $docenteId)
    {
        return $this->solicitudes->solicitudesAprobadasSinReprogramacion($docenteId);
    }

    public function reprogramacionesPorDocente(int $docenteId)
    {
        return $this->solicitudes->reprogramacionesPorDocente($docenteId);
    }

    private function eliminarConstancia(Solicitud $solicitud): void
    {
        if ($solicitud->constancia && $this->publicStorage->exists($solicitud->constancia)) {
            $this->publicStorage->delete($solicitud->constancia);
        }
    }
}