<?php

namespace App\Infraestructure\Imports;

use App\Domain\Docente\Entities\Docente;
use App\Domain\Seguridad\Entities\Role;
use App\Domain\Usuarios\Entities\User;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class DocentesImport implements ToModel, WithHeadingRow
{
    public function model(array $row)
    {
        if (!isset($row['cif'], $row['name'], $row['email'])) {
            return null;
        }

        $role = Role::where('name', 'docente')->first();

        $user = User::create([
            'name' => $row['name'],
            'email' => $row['email'],
            'password' => Str::random(40),
            'role_id' => $role?->id,
        ]);

        return new Docente([
            'cif' => $row['cif'],
            'usuario_id' => $user->id,
        ]);
    }

}
