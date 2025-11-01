<?php

namespace App\Application\Solicitudes\Notifications;

use App\Application\Solicitudes\Notifications\ValueObjects\SolicitudNotificacionContext;

interface SolicitudEstadoNotifier
{
    public function notify(SolicitudNotificacionContext $context): void;
}
