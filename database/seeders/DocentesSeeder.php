<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ModuloSecretaria\Docente;
use App\Models\User;
use App\Models\ModuloSecretaria\Carrera;
use App\Models\ModuloSeguridad\Role;
use Illuminate\Support\Facades\Hash;

class DocentesSeeder extends Seeder
{
    public function run(): void
    {
        $carrera = Carrera::where('nombre', 'Ingeniería en Sistemas de Información')->first();
        if (!$carrera) {
            $carrera = Carrera::first();
        }

        $docentes = [
            ['name' => 'José Durán', 'email' => 'joseduran@example.com', 'cif' => '22010116'],
            ['name' => 'Armando López', 'email' => 'armandolopez@example.com', 'cif' => '22010117'],
            ['name' => 'Freddy López', 'email' => 'freddylopez@example.com', 'cif' => '22010118'],
            ['name' => 'Tobías Solano', 'email' => 'tobiassolano@example.com', 'cif' => '22010119'],
        ];

        $role = Role::where('name', 'docente')->first();

        foreach ($docentes as $docente) {
            $user = User::create([
                'name' => $docente['name'],
                'email' => $docente['email'],
                'password' => Hash::make('password'),
                'role_id' => $role?->id,
            ]);

            Docente::create([
                'usuario_id' => $user->id,
                'carrera_id' => $carrera->id,
                'cif' => $docente['cif'],
            ]);
        }
    }
}
