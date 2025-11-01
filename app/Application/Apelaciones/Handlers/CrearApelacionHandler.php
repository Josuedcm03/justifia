<?php

namespace App\Application\Apelaciones\Handlers;

use App\Application\Apelaciones\Commands\CrearApelacionCommand;
use App\Application\Apelaciones\Handlers\Concerns\ValidatesApelacionData;
use App\Domain\Apelaciones\Entities\Apelacion;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;

final class CrearApelacionHandler
{
    use ValidatesApelacionData;

    public function __construct(private readonly ApelacionRepository $apelaciones)
    {
    }

    public function handle(CrearApelacionCommand $command): Apelacion
    {
        $observacion = $this->requireTexto($command->observacion());
        $solicitudId = $this->requireInt($command->solicitudId(), 'solicitud_id');
        $apelacionPadreId = $command->apelacionPadreId() !== null
            ? $this->requireInt($command->apelacionPadreId(), 'apelacion_id')
            : null;

        $entity = Apelacion::crear($observacion, $solicitudId, $apelacionPadreId);

        return $this->apelaciones->crear($entity);
    }
}
