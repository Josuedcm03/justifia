<?php

namespace App\Jobs;

use App\Mail\ApprovalMail;
use App\Mail\RejectionMail;
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
        public string $teacherEmail,
        public string $teacherName,
    ) {}

    public function handle(): void
    {
        if ($this->approved) {
            Mail::to($this->studentEmail)->send(new ApprovalMail($this->studentName, $this->studentEmail));
            Mail::to($this->teacherEmail)->send(new ApprovalMail($this->teacherName, $this->teacherEmail));
        } else {
            Mail::to($this->studentEmail)->send(new RejectionMail($this->studentName, $this->studentEmail));
            Mail::to($this->teacherEmail)->send(new RejectionMail($this->teacherName, $this->teacherEmail));
        }
    }
}