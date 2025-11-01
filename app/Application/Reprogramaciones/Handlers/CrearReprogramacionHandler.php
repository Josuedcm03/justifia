<?php

namespace App\Application\Reprogramaciones\Handlers;

use App\Application\Reprogramaciones\Commands\CrearReprogramacionCommand;
use App\Application\Reprogramaciones\Handlers\Concerns\ValidatesReprogramacionData;
use App\Application\Shared\Event\EventBus;
use App\Application\Reprogramaciones\Events\ReprogramacionCreada;
use App\Domain\Reprogramacion\Entities\Reprogramacion;
use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use InvalidArgumentException;

final class CrearReprogramacionHandler
{
    use ValidatesReprogramacionData;

    public function __construct(
        private readonly ReprogramacionRepository $reprogramaciones,
        private readonly SolicitudRepository $solicitudes,
        private readonly EventBus $events
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

        $this->events->publish(new ReprogramacionCreada($reprogramacion));

        return $reprogramacion;
    }
}
