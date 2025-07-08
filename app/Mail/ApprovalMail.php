<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApprovalMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $recipientName;
    public ?string $recipientEmail;

    public function __construct(string $recipientName, ?string $recipientEmail = null)
    {
        $this->recipientName = $recipientName;
        $this->recipientEmail = $recipientEmail;
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