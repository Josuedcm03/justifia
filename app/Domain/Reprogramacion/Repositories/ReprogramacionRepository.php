<?php

namespace App\Domain\Reprogramacion\Repositories;

use App\Domain\Reprogramacion\Entities\Reprogramacion;

interface ReprogramacionRepository
{
    public function create(array $data): Reprogramacion;

    public function update(Reprogramacion $reprogramacion, array $data): Reprogramacion;
}