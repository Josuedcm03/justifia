<?php

namespace App\Application\Solicitudes\Handlers\Concerns;

use DateTimeImmutable;
use InvalidArgumentException;

trait ValidatesSolicitudCommands
{
    private function parseFecha(string $fecha): DateTimeImmutable
    {
        $instancia = DateTimeImmutable::createFromFormat('Y-m-d', $fecha);

        if (! $instancia) {
            throw new InvalidArgumentException('La fecha de ausencia no tiene un formato válido.');
        }

        return $instancia;
    }

    private function requirePositiveInt(int $valor, string $key): int
    {
        if ($valor <= 0) {
            throw new InvalidArgumentException(sprintf('El campo %s debe ser un entero positivo.', $key));
        }

        return $valor;
    }
}
