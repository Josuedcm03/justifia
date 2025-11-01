<?php

namespace App\Infrastructure\Mail;

use App\Application\Shared\Contracts\Mailer;
use App\Application\Shared\Mail\MailNotification;
use App\Application\Shared\Mail\Notifications\ApelacionAprobadaNotification;
use App\Application\Shared\Mail\Notifications\ApelacionRechazadaNotification;
use App\Application\Shared\Mail\Notifications\ReprogramacionCreadaNotification;
use App\Application\Shared\Mail\Notifications\SolicitudAprobadaNotification;
use App\Application\Shared\Mail\Notifications\SolicitudRechazadaNotification;
use Illuminate\Mail\Mailer as IlluminateMailer;
use Illuminate\Mail\Mailable;
use InvalidArgumentException;

final class LaravelMailer implements Mailer
{
    public function __construct(private readonly IlluminateMailer $mailer)
    {
    }

    public function queue(MailNotification $notification): void
    {
        $this->mailer->to($notification->recipientEmail())->queue(
            $this->mapToMailable($notification)
        );
    }

    private function mapToMailable(MailNotification $notification): Mailable
    {
        return match (true) {
            $notification instanceof SolicitudAprobadaNotification => new ApprovalMail(
                $notification->recipientName(),
                $notification->recipientEmail(),
            ),
            $notification instanceof SolicitudRechazadaNotification => new RejectionMail(
                $notification->recipientName(),
                $notification->observaciones(),
                $notification->recipientEmail(),
            ),
            $notification instanceof ReprogramacionCreadaNotification => new RescheduleMail(
                $notification->recipientName(),
                $notification->fecha(),
                $notification->hora(),
                $notification->observaciones(),
                $notification->recipientEmail(),
            ),
            $notification instanceof ApelacionAprobadaNotification => new AppealApprovalMail(
                $notification->recipientName(),
                $notification->apelacion(),
                $notification->recipientEmail(),
            ),
            $notification instanceof ApelacionRechazadaNotification => new AppealRejectionMail(
                $notification->recipientName(),
                $notification->apelacion(),
                $notification->recipientEmail(),
            ),
            default => throw new InvalidArgumentException('Unsupported mail notification [' . $notification::class . ']'),
        };
    }
}

