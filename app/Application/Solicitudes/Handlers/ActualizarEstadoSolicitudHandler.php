<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Shared\Contracts\Mailer;
use App\Application\Solicitudes\Notifications\SolicitudAprobadaNotifier;
use App\Application\Solicitudes\Notifications\SolicitudEstadoNotifier;
use App\Application\Solicitudes\Notifications\SolicitudRechazadaNotifier;
use App\Application\Solicitudes\Notifications\SolicitudSinNotificacionNotifier;
use App\Application\Solicitudes\Notifications\ValueObjects\SolicitudNotificacionContext;
use App\Application\Solicitudes\Commands\ActualizarEstadoSolicitudCommand;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use App\Models\ModuloEstudiante\Solicitud as SolicitudModel;

final class ActualizarEstadoSolicitudHandler
{
    /** @var array<string, SolicitudEstadoNotifier> */
    private array $notificadoresPorEstado;

    private readonly SolicitudEstadoNotifier $notificadorPorDefecto;

    public function __construct(
        private readonly SolicitudRepository $solicitudes,
        private readonly Mailer $mailer
    ) {
        $this->notificadoresPorEstado = [
            EstadoSolicitud::Aprobada->value => new SolicitudAprobadaNotifier($mailer),
            EstadoSolicitud::Rechazada->value => new SolicitudRechazadaNotifier($mailer),
        ];

        $this->notificadorPorDefecto = new SolicitudSinNotificacionNotifier();
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

        $context = new SolicitudNotificacionContext(
            $studentUser->name,
            $studentUser->email,
            $teacherUser->name,
            $teacherUser->email,
            $solicitud->respuesta()?->value()
        );

        $this->resolverNotificador($solicitud->estado())->notify($context);
    }

    private function resolverNotificador(EstadoSolicitud $estado): SolicitudEstadoNotifier
    {
        return $this->notificadoresPorEstado[$estado->value] ?? $this->notificadorPorDefecto;
    }
}
