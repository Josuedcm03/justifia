<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Shared\Event\EventBus;
use App\Application\Solicitudes\Commands\ActualizarEstadoSolicitudCommand;
use App\Application\Solicitudes\Events\SolicitudEstadoActualizado;
use App\Domain\Shared\OptimisticLockException;
use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Solicitud\Repositories\SolicitudRepository;

final class ActualizarEstadoSolicitudHandler
{
    public function __construct(
        private readonly SolicitudRepository $solicitudes,
        private readonly EventBus $events
    ) {}

    public function handle(ActualizarEstadoSolicitudCommand $command): Solicitud
    {
        $solicitud = $this->solicitudes->findById($command->solicitudId());
        $expectedVersion = $command->version();

        if ($solicitud->version() !== $expectedVersion) {
            throw OptimisticLockException::conflicted(
                'Solicitud',
                $solicitud->id()?->value() ?? 0,
                $expectedVersion,
                $solicitud->version()
            );
        }

        $solicitud->actualizarEstado($command->estado(), $command->respuesta());

        $actualizada = $this->solicitudes->update($solicitud);

        $this->events->publish(new SolicitudEstadoActualizado($actualizada));

        return $actualizada;
    }
}
