<?php

namespace App\Domain\Apelaciones\Tree;

/**
 * Nodo compuesto que orquesta la recopilación del historial desde sus hijos.
 */
class HistorialComposite implements HistorialComponent
{
    /**
     * @var list<HistorialComponent>
     */
    private array $children = [];

    public function add(HistorialComponent $component): void
    {
        $this->children[] = $component;
    }

    public function historial(): array
    {
        $historial = [];
        foreach ($this->children as $child) {
            foreach ($child->historial() as $entry) {
                $historial[] = $entry;
            }
        }

        return $historial;
    }
}
