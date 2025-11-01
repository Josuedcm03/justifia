<?php

namespace App\Application\Apelaciones\Handlers;

use App\Application\Apelaciones\Commands\NotificarEstadoApelacionCommand;
use App\Application\Shared\Contracts\Mailer;
use App\Infraestructure\Mail\AppealApprovalMail;
use App\Infraestructure\Mail\AppealRejectionMail;

final class NotificarEstadoApelacionHandler
{
    public function __construct(private readonly Mailer $mailer)
    {
    }

    public function handle(NotificarEstadoApelacionCommand $command): void
    {
        $mailable = $command->aprobada()
            ? new AppealApprovalMail($command->nombre(), $command->apelacion(), $command->email())
            : new AppealRejectionMail($command->nombre(), $command->apelacion(), $command->email());

        $this->mailer->queue($command->email(), $mailable);
    }
}
