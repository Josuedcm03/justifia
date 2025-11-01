<?php

namespace App\Infraestructure\Mail;

use App\Application\Shared\Contracts\Mailer;
use Illuminate\Mail\Mailer as IlluminateMailer;
use Illuminate\Mail\Mailable;

final class LaravelMailer implements Mailer
{
    public function __construct(private readonly IlluminateMailer $mailer)
    {
    }

    public function queue(string $email, Mailable $mailable): void
    {
        $this->mailer->to($email)->queue($mailable);
    }
}
