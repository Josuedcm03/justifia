<?php

namespace App\Domain\Apelaciones\Tree;

/**
 * Hoja que representa un mensaje puntual dentro del historial.
 */
class MensajeLeaf implements HistorialComponent
{
    public function __construct(
        private readonly string $autor,
        private readonly string $mensaje
    ) {
    }

    public function historial(): array
    {
        return [[
            'autor' => $this->autor,
            'mensaje' => $this->mensaje,
        ]];
    }
}
