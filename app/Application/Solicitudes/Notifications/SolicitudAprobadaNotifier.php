<?php

namespace App\Application\Solicitudes\Notifications;

use App\Application\Shared\Contracts\Mailer;
use App\Application\Shared\Mail\Notifications\SolicitudAprobadaNotification;
use App\Application\Solicitudes\Notifications\ValueObjects\SolicitudNotificacionContext;

final class SolicitudAprobadaNotifier implements SolicitudEstadoNotifier
{
    public function __construct(private readonly Mailer $mailer)
    {
    }

    public function notify(SolicitudNotificacionContext $context): void
    {
        $this->mailer->queue(new SolicitudAprobadaNotification(
            $context->studentName(),
            $context->studentEmail()
        ));

        $this->mailer->queue(new SolicitudAprobadaNotification(
            $context->teacherName(),
            $context->teacherEmail()
        ));
    }
}
