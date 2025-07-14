<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\ModuloEstudiante\Apelacion;

class AppealRejectionMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $recipientName;
    public ?string $recipientEmail;
    public Apelacion $apelacion;

    public function __construct(string $recipientName, Apelacion $apelacion, ?string $recipientEmail = null)
    {
        $this->recipientName = $recipientName;
        $this->apelacion = $apelacion;
        $this->recipientEmail = $recipientEmail;
    }

    public function build(): self
    {
        return $this
            ->subject('Apelación Rechazada')
            ->view('emails.appeal-rejection');
    }
}
