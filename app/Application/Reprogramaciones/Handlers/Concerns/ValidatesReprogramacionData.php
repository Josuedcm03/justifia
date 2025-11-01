<?php

namespace App\Application\Reprogramaciones\Handlers\Concerns;

use DateTimeImmutable;
use InvalidArgumentException;

trait ValidatesReprogramacionData
{
    private function parseFecha(string $fecha): DateTimeImmutable
    {
        $instancia = DateTimeImmutable::createFromFormat('Y-m-d', $fecha);

        if (! $instancia) {
            throw new InvalidArgumentException('La fecha no tiene un formato válido.');
        }

        return $instancia;
    }

    private function requireHora(string $hora): string
    {
        $hora = trim($hora);
        if ($hora === '') {
            throw new InvalidArgumentException('La hora es obligatoria.');
        }

        $validada = DateTimeImmutable::createFromFormat('H:i', $hora);
        if (! $validada || $validada->format('H:i') !== $hora) {
            throw new InvalidArgumentException('La hora debe tener el formato HH:MM.');
        }

        return $hora;
    }
}
