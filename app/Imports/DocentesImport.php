<?php

namespace App\Imports;

use App\Models\ModuloSecretaria\Docente;
use App\Models\User;
use App\Models\ModuloSeguridad\Role;
use Illuminate\Support\Facades\Hash;
use Maatwebsite\Excel\Concerns\ToModel;
use Illuminate\Support\Facades\Mail;
use App\Mail\DocenteCredentialsMail;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class DocentesImport implements ToModel, WithHeadingRow
{
    public function model(array $row)
    {
        if (!isset($row['cif'], $row['name'], $row['email'])) {
            return null;
        }

        $password = $this->generatePassword($row['name'], $row['cif']);

        $role = Role::where('name', 'docente')->first();

        $user = User::create([
            'name' => $row['name'],
            'email' => $row['email'],
            'password' => Hash::make($password),
            'role_id' => $role?->id,
        ]);

        Mail::to($user->email)->send(
            new DocenteCredentialsMail($user->name, $password, $user->email)
        );

        return new Docente([
            'cif' => $row['cif'],
            'usuario_id' => $user->id,
        ]);
    }

    private function generatePassword(string $name, string $cif): string
    {
        $initials = implode('', array_map(fn ($part) => strtolower($part[0]), explode(' ', trim($name))));
        $numbers = substr(preg_replace('/\D/', '', $cif), -4);
        $random = random_int(10, 99);

        return $initials . $numbers . $random;
    }
}
