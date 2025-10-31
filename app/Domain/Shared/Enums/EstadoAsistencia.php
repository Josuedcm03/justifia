<?php

namespace App\Enums;

enum EstadoAsistencia: string
{
    case Pendiente = 'pendiente';
    case Asistio = 'asistio';
    case NoAsistio = 'no_asistio';
}