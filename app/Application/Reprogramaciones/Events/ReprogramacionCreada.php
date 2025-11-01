<?php

namespace App\Application\Reprogramaciones\Events;

use App\Domain\Reprogramacion\Entities\Reprogramacion;

final class ReprogramacionCreada
{
    public function __construct(private readonly Reprogramacion $reprogramacion)
    {
    }

    public function reprogramacion(): Reprogramacion
    {
        return $this->reprogramacion;
    }
}
