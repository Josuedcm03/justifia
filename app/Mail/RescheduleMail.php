<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class RescheduleMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $recipientName;
    public ?string $recipientEmail;
    public string $fecha;
    public string $hora;
    public ?string $observaciones;

    public function __construct(
        string $recipientName,
        string $fecha,
        string $hora,
        ?string $observaciones = null,
        ?string $recipientEmail = null
    ) {
        $this->recipientName = $recipientName;
        $this->fecha = $fecha;
        $this->hora = $hora;
        $this->observaciones = $observaciones;
        $this->recipientEmail = $recipientEmail;
    }

    public function build(): self
    {
        return $this
            ->subject('Reprogramación de Evaluación')
            ->view('emails.reschedule');
    }
}