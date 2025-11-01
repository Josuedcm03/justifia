<?php

namespace App\Domain\Apelaciones\Tree;

/**
 * Composite que encapsula los mensajes asociados a una apelación y sus hijas.
 */
class ApelacionComposite extends HistorialComposite
{
    public function __construct(string $observacion, ?string $respuesta)
    {
        $this->add(new MensajeLeaf('estudiante', $observacion));

        if ($respuesta !== null && trim($respuesta) !== '') {
            $this->add(new MensajeLeaf('secretaria', $respuesta));
        }
    }
}
