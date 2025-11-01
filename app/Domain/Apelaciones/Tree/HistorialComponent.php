<?php

namespace App\Domain\Apelaciones\Tree;

/**
 * Representa cualquier componente dentro del historial de apelaciones.
 */
interface HistorialComponent
{
    /**
     * @return list<array{autor:string,mensaje:string}>
     */
    public function historial(): array;
}
