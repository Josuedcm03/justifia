<?php

namespace App\Application\Solicitudes\Notifications;

use App\Application\Shared\Contracts\Mailer;
use App\Application\Shared\Mail\Notifications\SolicitudRechazadaNotification;
use App\Application\Solicitudes\Notifications\ValueObjects\SolicitudNotificacionContext;

final class SolicitudRechazadaNotifier implements SolicitudEstadoNotifier
{
    public function __construct(private readonly Mailer $mailer)
    {
    }

    public function notify(SolicitudNotificacionContext $context): void
    {
        $this->mailer->queue(new SolicitudRechazadaNotification(
            $context->studentName(),
            $context->studentEmail(),
            $context->respuesta()
        ));

        $this->mailer->queue(new SolicitudRechazadaNotification(
            $context->teacherName(),
            $context->teacherEmail(),
            $context->respuesta()
        ));
    }
}
