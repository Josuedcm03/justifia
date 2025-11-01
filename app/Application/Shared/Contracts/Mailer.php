<?php

namespace App\Application\Shared\Contracts;

use Illuminate\Mail\Mailable;

interface Mailer
{
    public function queue(string $email, Mailable $mailable): void;
}
