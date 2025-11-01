<?php

namespace App\Application\Shared\Contracts;

use App\Application\Shared\Mail\MailNotification;

interface Mailer
{
    public function queue(MailNotification $notification): void;
}

