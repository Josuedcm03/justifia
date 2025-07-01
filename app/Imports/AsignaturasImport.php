<?php

namespace App\Imports;

use App\Models\ModuloSecretaria\Asignatura;
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