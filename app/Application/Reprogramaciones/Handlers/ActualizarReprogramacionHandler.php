<?php

namespace App\Application\Reprogramaciones\Handlers;

use App\Application\Reprogramaciones\Commands\ActualizarReprogramacionCommand;
use App\Application\Reprogramaciones\Handlers\Concerns\ValidatesReprogramacionData;
use App\Domain\Reprogramacion\Entities\Reprogramacion;
use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;

final class ActualizarReprogramacionHandler
{
    use ValidatesReprogramacionData;

    public function __construct(private readonly ReprogramacionRepository $reprogramaciones)
    {
    }

    public function handle(ActualizarReprogramacionCommand $command): Reprogramacion
    {
        $reprogramacion = $this->reprogramaciones->findById($command->reprogramacionId());

        if ($command->fecha() !== null || $command->hora() !== null || $command->observaciones() !== null) {
            $fecha = $this->parseFecha($command->fecha() ?? $reprogramacion->fecha()->format('Y-m-d'));
            $hora = $this->requireHora($command->hora() ?? $reprogramacion->hora()->value());
            $observaciones = $command->observaciones() ?? $reprogramacion->observaciones()?->value();
            $reprogramacion->reprogramar($fecha, $hora, $observaciones);
        }

        if ($command->asistencia() !== null) {
            $reprogramacion->registrarAsistencia($command->asistencia());
        }

        return $this->reprogramaciones->update($reprogramacion);
    }
}
