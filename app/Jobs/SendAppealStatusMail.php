<?php

namespace App\Jobs;

use App\Mail\AppealApprovalMail;
use App\Mail\AppealRejectionMail;
use App\Models\ModuloEstudiante\Apelacion;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendAppealStatusMail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public bool $approved,
        public string $studentEmail,
        public string $studentName,
        public Apelacion $apelacion,
    ) {}

    public function handle(): void
    {
        if ($this->approved) {
            Mail::to($this->studentEmail)
                ->queue(new AppealApprovalMail(
                    $this->studentName,
                    $this->apelacion,
                    $this->studentEmail
                ));
        } else {
            Mail::to($this->studentEmail)
                ->queue(new AppealRejectionMail(
                    $this->studentName,
                    $this->apelacion,
                    $this->studentEmail
                ));
        }
    }
}