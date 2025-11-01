<?php

namespace App\Application\Reprogramaciones\Queries;

use App\Application\Reprogramaciones\DTOs\ReprogramacionIdDTO;

final class ObtenerReprogramacionPorIdQuery
{
    public function __construct(private readonly ReprogramacionIdDTO $payload)
    {
    }

    public function reprogramacionId(): int
    {
        return $this->payload->reprogramacionId();
    }
}
