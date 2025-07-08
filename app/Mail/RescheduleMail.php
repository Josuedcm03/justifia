<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RescheduleMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $recipientName;
    public ?string $recipientEmail;
    public string $fecha;
    public string $hora;
    public string $observaciones;

    public function __construct(
        string $recipientName,
        string $fecha,
        string $hora,
        string $observaciones,
        ?string $recipientEmail = null
    ) {
        $this->recipientName = $recipientName;
        $this->fecha = $fecha;
        $this->hora = $hora;
        $this->observaciones = $observaciones;
        $this->recipientEmail = $recipientEmail;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reprogramación de Evaluación'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.reschedule'
        );
    }

    public function attachments(): array
    {
        return [];
    }
}