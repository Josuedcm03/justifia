<?php

namespace App\Jobs;

use App\Mail\ApprovalMail;
use App\Mail\RejectionMail;
use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendStatusMail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public bool $approved,
        public string $studentEmail,
        public string $studentName,
        public Solicitud $solicitud,
    ) {}

    public function handle(): void
    {
        if ($this->approved) {
            Mail::to($this->studentEmail)
                ->queue(new ApprovalMail($this->studentName, $this->solicitud, $this->studentEmail));
        } else {
            Mail::to($this->studentEmail)
                ->queue(new RejectionMail($this->studentName, $this->solicitud, $this->studentEmail));
        }
    }
}