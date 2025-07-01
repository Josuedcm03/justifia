<?php

namespace App\Imports;

use App\Models\ModuloSecretaria\Docente;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class DocentesImport implements ToModel, WithHeadingRow
{
    public function model(array $row)
    {
        return new Docente([
            'cif' => $row['cif'] ?? null,
        ]);
    }
}