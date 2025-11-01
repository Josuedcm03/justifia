<?php

namespace App\Application\Shared\Mail;

interface MailNotification
{
    public function recipientName(): string;

    public function recipientEmail(): string;
}
