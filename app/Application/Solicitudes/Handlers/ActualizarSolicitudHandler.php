<?php

namespace App\Application\Solicitudes\Handlers;

use App\Application\Shared\Contracts\FileStorage;
use App\Application\Solicitudes\Commands\ActualizarSolicitudCommand;
use App\Application\Solicitudes\Handlers\Concerns\ValidatesSolicitudCommands;
use App\Domain\Shared\ValueObjects\ArchivoConstancia;
use App\Domain\Shared\OptimisticLockException;
use App\Domain\Solicitud\Entities\Solicitud;
use App\Domain\Solicitud\Repositories\SolicitudRepository;

final class ActualizarSolicitudHandler
{
    use ValidatesSolicitudCommands;

    public function __construct(
        private readonly SolicitudRepository $solicitudes,
        private readonly FileStorage $storage
    ) {
    }

    public function handle(ActualizarSolicitudCommand $command): Solicitud
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

        $fechaAusencia = $this->parseFecha($command->fechaAusencia());
        $docenteId = $this->requirePositiveInt($command->docenteId(), 'docente_id');
        $asignaturaId = $this->requirePositiveInt($command->asignaturaId(), 'asignatura_id');
        $tipoConstanciaId = $this->requirePositiveInt($command->tipoConstanciaId(), 'tipo_constancia_id');

        $solicitud->actualizarDatos(
            $fechaAusencia,
            $command->observaciones() ?? $solicitud->observaciones()->value(),
            $docenteId,
            $asignaturaId,
            $tipoConstanciaId
        );

        $constanciaAnterior = $solicitud->constancia();
        $nuevaConstancia = $command->constancia();

        if ($nuevaConstancia) {
            $rutaConstancia = $this->storage->store('constancias', $nuevaConstancia);
            $solicitud->adjuntarConstancia(ArchivoConstancia::fromPath($rutaConstancia));
            $this->eliminarConstanciaPath($constanciaAnterior?->path());
        } elseif ($command->eliminarConstancia()) {
            $solicitud->eliminarConstancia();
            $this->eliminarConstanciaPath($constanciaAnterior?->path());
        }

        return $this->solicitudes->update($solicitud);
    }

    private function eliminarConstanciaPath(?string $path): void
    {
        if ($path && $this->storage->exists($path)) {
            $this->storage->delete($path);
        }
    }
}
