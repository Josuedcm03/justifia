<?php

namespace App\Application\Apelaciones\Handlers;

use App\Application\Apelaciones\Commands\NotificarEstadoApelacionCommand;
use App\Application\Shared\Contracts\Mailer;
use App\Application\Shared\Mail\Notifications\ApelacionAprobadaNotification;
use App\Application\Shared\Mail\Notifications\ApelacionRechazadaNotification;

final class NotificarEstadoApelacionHandler
{
    public function __construct(private readonly Mailer $mailer)
    {
    }

    public function handle(NotificarEstadoApelacionCommand $command): void
    {
        $notification = $command->aprobada()
            ? new ApelacionAprobadaNotification($command->nombre(), $command->email(), $command->apelacion())
            : new ApelacionRechazadaNotification($command->nombre(), $command->email(), $command->apelacion());

        $this->mailer->queue($notification);
    }
}
