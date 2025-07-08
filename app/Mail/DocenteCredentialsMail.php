<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class DocenteCredentialsMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $recipientName;
    public string $password;
    public string $recipientEmail;

    public function __construct(string $recipientName, string $password, string $recipientEmail)
    {
        $this->recipientName = $recipientName;
        $this->password = $password;
        $this->recipientEmail = $recipientEmail;
    }

    public function build(): self
    {
        return $this
            ->subject('Credenciales de Acceso')
            ->view('emails.docente-credentials');
    }
}