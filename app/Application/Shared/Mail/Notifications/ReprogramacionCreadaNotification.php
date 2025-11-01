<?php

namespace App\Application\Shared\Mail\Notifications;

use App\Application\Shared\Mail\MailNotification;

final class ReprogramacionCreadaNotification implements MailNotification
{
    public function __construct(
        private readonly string $recipientName,
        private readonly string $recipientEmail,
        private readonly string $fecha,
        private readonly string $hora,
        private readonly ?string $observaciones
    ) {
    }

    public function recipientName(): string
    {
        return $this->recipientName;
    }

    public function recipientEmail(): string
    {
        return $this->recipientEmail;
    }

    public function fecha(): string
    {
        return $this->fecha;
    }

    public function hora(): string
    {
        return $this->hora;
    }

    public function observaciones(): ?string
    {
        return $this->observaciones;
    }
}
