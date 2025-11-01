<?php

namespace App\Application\Solicitudes\Notifications;

use App\Application\Solicitudes\Notifications\ValueObjects\SolicitudNotificacionContext;

final class SolicitudSinNotificacionNotifier implements SolicitudEstadoNotifier
{
    public function notify(SolicitudNotificacionContext $context): void
    {
        // Intentionally left blank: algunos estados no requieren notificaciones.
    }
}
