<?php

namespace App\Application\Shared\Mail\Notifications;

use App\Application\Shared\Mail\MailNotification;
use App\Domain\Apelaciones\Entities\Apelacion;

final class ApelacionAprobadaNotification implements MailNotification
{
    public function __construct(
        private readonly string $recipientName,
        private readonly string $recipientEmail,
        private readonly Apelacion $apelacion
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

    public function apelacion(): Apelacion
    {
        return $this->apelacion;
    }
}
