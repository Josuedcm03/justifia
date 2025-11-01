<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Shared\Contracts\Mailer;
use App\Application\Shared\Mail\Notifications\SolicitudAprobadaNotification;
use App\Application\Shared\Mail\Notifications\SolicitudRechazadaNotification;
use App\Application\Solicitudes\Commands\ActualizarEstadoSolicitudCommand;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
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
            $this->mailer->queue(new SolicitudAprobadaNotification(
                $studentUser->name,
                $studentUser->email
            ));

            $this->mailer->queue(new SolicitudAprobadaNotification(
                $teacherUser->name,
                $teacherUser->email
            ));
        }

        if ($solicitud->estado() === EstadoSolicitud::Rechazada) {
            $respuesta = $solicitud->respuesta()?->value();

            $this->mailer->queue(new SolicitudRechazadaNotification(
                $studentUser->name,
                $studentUser->email,
                $respuesta
            ));

            $this->mailer->queue(new SolicitudRechazadaNotification(
                $teacherUser->name,
                $teacherUser->email,
                $respuesta
            ));
        }
    }
}
