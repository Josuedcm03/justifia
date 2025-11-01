<?php

namespace App\Application\Solicitudes\Observers;

use App\Application\Shared\Contracts\Mailer;
use App\Application\Shared\Mail\Notifications\SolicitudAprobadaNotification;
use App\Application\Shared\Mail\Notifications\SolicitudRechazadaNotification;
use App\Application\Solicitudes\Events\SolicitudEstadoActualizado;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Models\ModuloEstudiante\Solicitud as SolicitudModel;
use Illuminate\Contracts\Auth\Authenticatable;

final class SolicitudEstadoActualizadoMailerObserver
{
    public function __construct(private readonly Mailer $mailer)
    {
    }

    public function __invoke(SolicitudEstadoActualizado $event): void
    {
        $solicitud = $event->solicitud();
        $solicitudId = $solicitud->id()?->value();

        if ($solicitudId === null) {
            return;
        }

        $modelo = SolicitudModel::with(['estudiante.usuario', 'docente.usuario'])->find($solicitudId);

        if (! $modelo) {
            return;
        }

        $recipients = array_filter([
            $modelo->estudiante->usuario,
            $modelo->docente->usuario,
        ]);

        if ($recipients === []) {
            return;
        }

        $notificationFactory = match ($solicitud->estado()) {
            EstadoSolicitud::Aprobada => static fn (Authenticatable $user) => new SolicitudAprobadaNotification(
                $user->name,
                $user->email
            ),
            EstadoSolicitud::Rechazada => function (Authenticatable $user) use ($solicitud) {
                return new SolicitudRechazadaNotification(
                    $user->name,
                    $user->email,
                    $solicitud->respuesta()?->value()
                );
            },
            default => null,
        };

        if ($notificationFactory === null) {
            return;
        }

        foreach ($recipients as $user) {
            $this->mailer->queue($notificationFactory($user));
        }
    }
}
