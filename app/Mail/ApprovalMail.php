<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
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

    public function build(): self
    {
        return $this
            ->subject('Solicitud Aprobada')
            ->view('emails.approval');
    }
}