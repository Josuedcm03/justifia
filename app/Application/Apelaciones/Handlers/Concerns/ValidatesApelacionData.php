<?php

namespace App\Application\Apelaciones\Handlers\Concerns;

use InvalidArgumentException;

trait ValidatesApelacionData
{
    private function requireInt(?int $valor, string $key): int
    {
        if ($valor === null) {
            throw new InvalidArgumentException(sprintf('El campo %s es obligatorio.', $key));
        }

        if ($valor <= 0) {
            throw new InvalidArgumentException(sprintf('El campo %s debe ser un entero positivo.', $key));
        }

        return $valor;
    }

    private function requireTexto(?string $texto): string
    {
        $texto = $texto !== null ? trim($texto) : '';
        if ($texto === '') {
            throw new InvalidArgumentException('El texto es obligatorio.');
        }

        return $texto;
    }
}
