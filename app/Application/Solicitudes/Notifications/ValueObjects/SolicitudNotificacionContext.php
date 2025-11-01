<?php

namespace App\Application\Solicitudes\Notifications\ValueObjects;

final class SolicitudNotificacionContext
{
    public function __construct(
        private readonly string $studentName,
        private readonly string $studentEmail,
        private readonly string $teacherName,
        private readonly string $teacherEmail,
        private readonly ?string $respuesta
    ) {
    }

    public function studentName(): string
    {
        return $this->studentName;
    }

    public function studentEmail(): string
    {
        return $this->studentEmail;
    }

    public function teacherName(): string
    {
        return $this->teacherName;
    }

    public function teacherEmail(): string
    {
        return $this->teacherEmail;
    }

    public function respuesta(): ?string
    {
        return $this->respuesta;
    }
}
