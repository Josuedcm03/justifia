<?php

namespace App\Imports;

use App\Domain\Catalogo\Entities\Asignatura;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class AsignaturasImport implements ToModel, WithHeadingRow
{
    public function model(array $row)
    {
        return new Asignatura([
            'nombre' => $row['nombre'] ?? null,
        ]);
    }
}