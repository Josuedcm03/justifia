<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Shared\Contracts\FileStorage;
use App\Application\Solicitudes\Commands\EliminarSolicitudCommand;
use App\Domain\Solicitud\Repositories\SolicitudRepository;

final class EliminarSolicitudHandler
{
    public function __construct(
        private readonly SolicitudRepository $solicitudes,
        private readonly FileStorage $storage
    ) {
    }

    public function handle(EliminarSolicitudCommand $command): void
    {
        $solicitud = $this->solicitudes->findById($command->solicitudId());

        $constancia = $solicitud->constancia();
        if ($constancia && $this->storage->exists($constancia->path())) {
            $this->storage->delete($constancia->path());
        }

        $this->solicitudes->delete($solicitud);
    }
}
