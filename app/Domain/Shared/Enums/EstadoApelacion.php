<?php

namespace App\Domain\Shared\Enums;

enum EstadoApelacion: string
{
    case Pendiente = 'pendiente';
    case Aprobada = 'aprobada';
    case Rechazada = 'rechazada';
}
