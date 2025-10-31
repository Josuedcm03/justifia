<?php

namespace App\Domain\Shared\Enums;

enum EstadoAsistencia: string
{
    case Pendiente = 'pendiente';
    case Aprobada = 'aprobada';
    case Rechazada = 'rechazada';
}
