<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RejectionMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $recipientName;
    public ?string $recipientEmail;
    public ?string $observaciones;

    public function __construct(string $recipientName, ?string $observaciones = null, ?string $recipientEmail = null)
    {
        $this->recipientName = $recipientName;
        $this->recipientEmail = $recipientEmail;
        $this->observaciones = $observaciones;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Solicitud Rechazada'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.rejection'
        );
    }

    public function attachments(): array
    {
        return [];
    }
}