<?php

namespace Tests\Unit\Application\Solicitudes\Notifications;

use App\Application\Shared\Contracts\Mailer;
use App\Application\Shared\Mail\MailNotification;
use App\Application\Shared\Mail\Notifications\SolicitudAprobadaNotification;
use App\Application\Shared\Mail\Notifications\SolicitudRechazadaNotification;
use App\Application\Solicitudes\Notifications\SolicitudAprobadaNotifier;
use App\Application\Solicitudes\Notifications\SolicitudRechazadaNotifier;
use App\Application\Solicitudes\Notifications\SolicitudSinNotificacionNotifier;
use App\Application\Solicitudes\Notifications\ValueObjects\SolicitudNotificacionContext;
use PHPUnit\Framework\TestCase;

final class SolicitudEstadoNotifierTest extends TestCase
{
    public function test_aprobada_notifier_envia_notificaciones_para_estudiante_y_docente(): void
    {
        $mailer = new FakeMailer();
        $notifier = new SolicitudAprobadaNotifier($mailer);

        $context = new SolicitudNotificacionContext(
            'Estudiante Ejemplo',
            'estudiante@example.com',
            'Docente Ejemplo',
            'docente@example.com',
            null
        );

        $notifier->notify($context);

        $this->assertCount(2, $mailer->queued);
        $this->assertInstanceOf(SolicitudAprobadaNotification::class, $mailer->queued[0]);
        $this->assertSame('Estudiante Ejemplo', $mailer->queued[0]->recipientName());
        $this->assertInstanceOf(SolicitudAprobadaNotification::class, $mailer->queued[1]);
        $this->assertSame('Docente Ejemplo', $mailer->queued[1]->recipientName());
    }

    public function test_rechazada_notifier_incluye_observaciones_en_ambos_destinatarios(): void
    {
        $mailer = new FakeMailer();
        $notifier = new SolicitudRechazadaNotifier($mailer);

        $context = new SolicitudNotificacionContext(
            'Estudiante Ejemplo',
            'estudiante@example.com',
            'Docente Ejemplo',
            'docente@example.com',
            'Observaciones de rechazo'
        );

        $notifier->notify($context);

        $this->assertCount(2, $mailer->queued);
        $this->assertInstanceOf(SolicitudRechazadaNotification::class, $mailer->queued[0]);
        $this->assertSame('Observaciones de rechazo', $mailer->queued[0]->observaciones());
        $this->assertInstanceOf(SolicitudRechazadaNotification::class, $mailer->queued[1]);
        $this->assertSame('Observaciones de rechazo', $mailer->queued[1]->observaciones());
    }

    public function test_sin_notificacion_notifier_no_envia_correos(): void
    {
        $mailer = new FakeMailer();
        $notifier = new SolicitudSinNotificacionNotifier();

        $context = new SolicitudNotificacionContext(
            'Estudiante Ejemplo',
            'estudiante@example.com',
            'Docente Ejemplo',
            'docente@example.com',
            null
        );

        $notifier->notify($context);

        $this->assertEmpty($mailer->queued);
    }
}

/**
 * @internal
 */
final class FakeMailer implements Mailer
{
    /** @var list<MailNotification> */
    public array $queued = [];

    public function queue(MailNotification $notification): void
    {
        $this->queued[] = $notification;
    }
}
