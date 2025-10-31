<?php

namespace App\Mail;

use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApprovalMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $recipientName;
    public ?string $recipientEmail;
    public Solicitud $solicitud;

    public function __construct(string $recipientName, Solicitud $solicitud, ?string $recipientEmail = null)
    {
        $this->recipientName = $recipientName;
        $this->recipientEmail = $recipientEmail;
        $this->solicitud = $solicitud;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Solicitud Aprobada'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.approval'
        );
    }

    public function attachments(): array
    {
        return [];
    }
}