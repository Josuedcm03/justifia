<?php

namespace App\Domain\Reprogramacion\Repositories;

use App\Domain\Reprogramacion\Entities\Reprogramacion;

interface ReprogramacionRepository
{
    public function findById(int $id): Reprogramacion;

    public function create(Reprogramacion $reprogramacion): Reprogramacion;

    public function update(Reprogramacion $reprogramacion): Reprogramacion;
}