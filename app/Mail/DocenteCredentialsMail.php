<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class DocenteCredentialsMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $recipientName;
    public string $recipientEmail;

    public function __construct(string $recipientName, string $recipientEmail)
    {
        $this->recipientName = $recipientName;
        $this->recipientEmail = $recipientEmail;
    }

    public function build(): self
    {
        return $this
            ->subject('Credenciales de Acceso')
            ->view('emails.docente-credentials');
    }
}