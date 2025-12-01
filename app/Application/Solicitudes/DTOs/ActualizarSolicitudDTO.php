<?php

namespace App\Application\Solicitudes\DTOs;

use Illuminate\Http\UploadedFile;

final class ActualizarSolicitudDTO
{
    public function __construct(
        private readonly int $solicitudId,
        private readonly string $fechaAusencia,
        private readonly int $docenteId,
        private readonly int $asignaturaId,
        private readonly int $tipoConstanciaId,
        private readonly ?string $observaciones,
        private readonly ?UploadedFile $constancia,
        private readonly bool $eliminarConstancia,
        private readonly int $version
    ) {
    }

    public function solicitudId(): int
    {
        return $this->solicitudId;
    }

    public function fechaAusencia(): string
    {
        return $this->fechaAusencia;
    }

    public function docenteId(): int
    {
        return $this->docenteId;
    }

    public function asignaturaId(): int
    {
        return $this->asignaturaId;
    }

    public function tipoConstanciaId(): int
    {
        return $this->tipoConstanciaId;
    }

    public function observaciones(): ?string
    {
        return $this->observaciones;
    }

    public function constancia(): ?UploadedFile
    {
        return $this->constancia;
    }

    public function eliminarConstancia(): bool
    {
        return $this->eliminarConstancia;
    }

    public function version(): int
    {
        return $this->version;
    }
}
