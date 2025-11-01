<?php

namespace App\Jobs;

use App\Application\Apelaciones\Commands\NotificarEstadoApelacionCommand;
use App\Application\Apelaciones\DTOs\NotificarEstadoApelacionDTO;
use App\Application\Apelaciones\Handlers\NotificarEstadoApelacionHandler;
use App\Domain\Apelaciones\Entities\Apelacion;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendAppealStatusMail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public bool $approved,
        public string $studentEmail,
        public string $studentName,
        public Apelacion $apelacion,
    ) {}

    public function handle(NotificarEstadoApelacionHandler $handler): void
    {
        $handler->handle(
            new NotificarEstadoApelacionCommand(
                new NotificarEstadoApelacionDTO(
                    $this->approved,
                    $this->studentEmail,
                    $this->studentName,
                    $this->apelacion,
                )
            )
        );
    }
}
