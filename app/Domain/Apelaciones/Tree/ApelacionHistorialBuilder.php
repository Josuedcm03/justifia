<?php

namespace App\Domain\Apelaciones\Tree;

final class ApelacionHistorialBuilder
{
    /**
     * @param list<array{observacion:string,respuesta:?string}> $apelaciones
     * @return list<array{autor:string,mensaje:string}>
     */
    public function build(?string $respuestaInicial, array $apelaciones): array
    {
        $root = new HistorialComposite();

        if ($respuestaInicial !== null && trim($respuestaInicial) !== '') {
            $root->add(new MensajeLeaf('secretaria', trim($respuestaInicial)));
        }

        $cursor = $root;

        foreach ($apelaciones as $datos) {
            $composite = new ApelacionComposite($datos['observacion'], $datos['respuesta']);
            $cursor->add($composite);
            $cursor = $composite;
        }

        return $root->historial();
    }
}
