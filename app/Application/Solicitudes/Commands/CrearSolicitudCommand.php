<?php

namespace App\Application\Solicitudes\Commands;

use App\Application\Solicitudes\DTOs\CrearSolicitudDTO;
use Illuminate\Http\UploadedFile;

final class CrearSolicitudCommand
{
    public function __construct(private readonly CrearSolicitudDTO $payload)
    {
    }

    public function fechaAusencia(): string
    {
        return $this->payload->fechaAusencia();
    }

    public function docenteId(): int
    {
        return $this->payload->docenteId();
    }

    public function asignaturaId(): int
    {
        return $this->payload->asignaturaId();
    }

    public function tipoConstanciaId(): int
    {
        return $this->payload->tipoConstanciaId();
    }

    public function observaciones(): ?string
    {
        return $this->payload->observaciones();
    }

    public function constancia(): ?UploadedFile
    {
        return $this->payload->constancia();
    }

    public function estudianteId(): int
    {
        return $this->payload->estudianteId();
    }
}
