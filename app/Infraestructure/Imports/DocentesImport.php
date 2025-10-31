<?php

namespace App\Imports;

use App\Models\ModuloSecretaria\Docente;
use App\Models\User;
use App\Models\ModuloSeguridad\Role;
use Illuminate\Support\Facades\Password;
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
