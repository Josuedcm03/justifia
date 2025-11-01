<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Shared\Contracts\Mailer;
use App\Application\Solicitudes\Commands\ActualizarEstadoSolicitudCommand;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use App\Infraestructure\Mail\ApprovalMail;
use App\Infraestructure\Mail\RejectionMail;
use App\Models\ModuloEstudiante\Solicitud as SolicitudModel;

final class ActualizarEstadoSolicitudHandler
{
    public function __construct(
        private readonly SolicitudRepository $solicitudes,
        private readonly Mailer $mailer
    ) {
    }

    public function handle(ActualizarEstadoSolicitudCommand $command): Solicitud
    {
        $solicitud = $this->solicitudes->findById($command->solicitudId());

        $solicitud->actualizarEstado($command->estado(), $command->respuesta());

        $actualizada = $this->solicitudes->update($solicitud);

        $this->notificarCambioEstado($actualizada);

        return $actualizada;
    }

    private function notificarCambioEstado(Solicitud $solicitud): void
    {
        $modelo = SolicitudModel::with(['estudiante.usuario', 'docente.usuario'])
            ->find($solicitud->id()?->value());

        if (! $modelo) {
            return;
        }

        $studentUser = $modelo->estudiante->usuario;
        $teacherUser = $modelo->docente->usuario;

        if ($solicitud->estado() === EstadoSolicitud::Aprobada) {
            $this->mailer->queue(
                $studentUser->email,
                new ApprovalMail($studentUser->name, $modelo, $studentUser->email)
            );
            $this->mailer->queue(
                $teacherUser->email,
                new ApprovalMail($teacherUser->name, $modelo, $teacherUser->email)
            );
        }

        if ($solicitud->estado() === EstadoSolicitud::Rechazada) {
            $this->mailer->queue(
                $studentUser->email,
                new RejectionMail($studentUser->name, $modelo, $studentUser->email)
            );
            $this->mailer->queue(
                $teacherUser->email,
                new RejectionMail($teacherUser->name, $modelo, $teacherUser->email)
            );
        }
    }
}
