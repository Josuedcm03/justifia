<?php

namespace App\Application\Reprogramaciones\Handlers;

use App\Application\Reprogramaciones\Commands\CrearReprogramacionCommand;
use App\Application\Reprogramaciones\Handlers\Concerns\ValidatesReprogramacionData;
use App\Application\Shared\Contracts\Mailer;
use App\Domain\Reprogramacion\Entities\Reprogramacion;
use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use App\Mail\RescheduleMail;
use App\Models\ModuloEstudiante\Solicitud as SolicitudModel;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

final class CrearReprogramacionHandler
{
    use ValidatesReprogramacionData;

    public function __construct(
        private readonly ReprogramacionRepository $reprogramaciones,
        private readonly SolicitudRepository $solicitudes,
        private readonly Mailer $mailer
    ) {
    }

    public function handle(CrearReprogramacionCommand $command): Reprogramacion
    {
        $solicitud = $this->solicitudes->findById($command->solicitudId());

        $solicitudId = $solicitud->id()?->value();
        if ($solicitudId === null) {
            throw new InvalidArgumentException('La solicitud debe existir para reprogramar.');
        }

        $fecha = $this->parseFecha($command->fecha());
        $hora = $this->requireHora($command->hora());

        $entity = Reprogramacion::crear(
            $fecha,
            $hora,
            $command->observaciones(),
            $solicitudId
        );

        $reprogramacion = $this->reprogramaciones->create($entity);

        $solicitudModel = SolicitudModel::with('estudiante.usuario')->find($solicitudId);

        if ($solicitudModel) {
            $studentUser = $solicitudModel->estudiante->usuario;

            $this->mailer->queue(
                $studentUser->email,
                new RescheduleMail(
                    $studentUser->name,
                    Carbon::parse($reprogramacion->fecha()->format('Y-m-d'))->format('d-m-Y'),
                    $reprogramacion->hora()->value(),
                    $reprogramacion->observaciones()?->value(),
                    $studentUser->email
                )
            );
        }

        return $reprogramacion;
    }
}
