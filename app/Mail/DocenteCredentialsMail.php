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
    protected string $token;

    public function __construct(string $recipientName, string $recipientEmail, string $token)
    {
        $this->recipientName = $recipientName;
        $this->recipientEmail = $recipientEmail;
        $this->token = $token;
    }

    public function build(): self
    {
        $url = url(route('password.reset', [
            'token' => $this->token,
            'email' => $this->recipientEmail,
        ], false));

        return $this
            ->subject('Credenciales de Acceso')
            ->view('emails.docente-credentials')
            ->with([
                'url' => $url,
            ]);
    }
}