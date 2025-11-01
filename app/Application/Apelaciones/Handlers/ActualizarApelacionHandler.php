<?php

namespace App\Application\Apelaciones\Handlers;

use App\Application\Apelaciones\Commands\ActualizarApelacionCommand;
use App\Application\Apelaciones\Handlers\Concerns\ValidatesApelacionData;
use App\Domain\Apelaciones\Entities\Apelacion;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;
use App\Domain\Shared\Enums\EstadoApelacion;

final class ActualizarApelacionHandler
{
    use ValidatesApelacionData;

    public function __construct(private readonly ApelacionRepository $apelaciones)
    {
    }

    public function handle(ActualizarApelacionCommand $command): Apelacion
    {
        $apelacion = $this->apelaciones->findById($command->apelacionId());
        $estado = $command->estado() ?? $apelacion->estado();

        if ($estado === EstadoApelacion::Pendiente) {
            $apelacion->dejarPendiente();
        } else {
            $respuesta = $this->requireTexto($command->respuesta());
            $apelacion->registrarRespuesta($respuesta, $estado);
        }

        return $this->apelaciones->actualizar($apelacion);
    }
}
