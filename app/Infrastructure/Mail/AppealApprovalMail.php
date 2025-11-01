<?php

namespace App\Infrastructure\Mail;

use App\Domain\Apelaciones\Entities\Apelacion;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class AppealApprovalMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $recipientName;
    public ?string $recipientEmail;
    public Apelacion $apelacion;

    public function __construct(string $recipientName, Apelacion $apelacion, ?string $recipientEmail = null)
    {
        $this->recipientName = $recipientName;
        $this->recipientEmail = $recipientEmail;
        $this->apelacion = $apelacion;
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Apelación Aprobada');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.appeal-approval');
    }

    public function attachments(): array
    {
        return [];
    }
}

