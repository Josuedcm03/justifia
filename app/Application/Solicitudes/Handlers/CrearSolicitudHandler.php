<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Shared\Contracts\FileStorage;
use App\Application\Solicitudes\Commands\CrearSolicitudCommand;
use App\Application\Solicitudes\Handlers\Concerns\ValidatesSolicitudCommands;
use App\Domain\Shared\ValueObjects\ArchivoConstancia;
use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Solicitud\Repositories\SolicitudRepository;

final class CrearSolicitudHandler
{
    use ValidatesSolicitudCommands;

    public function __construct(
        private readonly SolicitudRepository $solicitudes,
        private readonly FileStorage $storage
    ) {
    }

    public function handle(CrearSolicitudCommand $command): Solicitud
    {
        $fechaAusencia = $this->parseFecha($command->fechaAusencia());
        $docenteId = $this->requirePositiveInt($command->docenteId(), 'docente_id');
        $asignaturaId = $this->requirePositiveInt($command->asignaturaId(), 'asignatura_id');
        $tipoConstanciaId = $this->requirePositiveInt($command->tipoConstanciaId(), 'tipo_constancia_id');

        $rutaConstancia = null;
        $constancia = $command->constancia();

        if ($constancia) {
            $rutaConstancia = $this->storage->store('constancias', $constancia);
        }

        $entity = Solicitud::crearNueva(
            $fechaAusencia,
            $rutaConstancia ? ArchivoConstancia::fromPath($rutaConstancia) : null,
            $command->observaciones() ?? '',
            $this->requirePositiveInt($command->estudianteId(), 'estudiante_id'),
            $docenteId,
            $asignaturaId,
            $tipoConstanciaId
        );

        return $this->solicitudes->create($entity);
    }
}
