<?php

namespace App\Jobs;

use App\Application\Shared\Contracts\Mailer;
use App\Application\Shared\Mail\Notifications\SolicitudAprobadaNotification;
use App\Application\Shared\Mail\Notifications\SolicitudRechazadaNotification;
use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendStatusMail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public bool $approved,
        public string $studentEmail,
        public string $studentName,
        public Solicitud $solicitud,
    ) {}

    public function handle(Mailer $mailer): void
    {
        if ($this->approved) {
            $mailer->queue(new SolicitudAprobadaNotification(
                $this->studentName,
                $this->studentEmail
            ));
        } else {
            $mailer->queue(new SolicitudRechazadaNotification(
                $this->studentName,
                $this->studentEmail,
                $this->solicitud->respuesta()?->value()
            ));
        }
    }
}
