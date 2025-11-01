<?php

namespace App\Application\Reprogramaciones\Observers;

use App\Application\Reprogramaciones\Events\ReprogramacionCreada;
use App\Application\Shared\Contracts\Mailer;
use App\Application\Shared\Mail\Notifications\ReprogramacionCreadaNotification;
use App\Models\ModuloEstudiante\Solicitud as SolicitudModel;
use Illuminate\Support\Carbon;

final class ReprogramacionCreadaMailerObserver
{
    public function __construct(private readonly Mailer $mailer)
    {
    }

    public function __invoke(ReprogramacionCreada $event): void
    {
        $reprogramacion = $event->reprogramacion();
        $solicitudModel = SolicitudModel::with('estudiante.usuario')->find($reprogramacion->solicitudId()->value());

        if (! $solicitudModel) {
            return;
        }

        $studentUser = $solicitudModel->estudiante->usuario;

        $this->mailer->queue(new ReprogramacionCreadaNotification(
            $studentUser->name,
            $studentUser->email,
            Carbon::parse($reprogramacion->fecha()->format('Y-m-d'))->format('d-m-Y'),
            $reprogramacion->hora()->value(),
            $reprogramacion->observaciones()?->value()
        ));
    }
}
