<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ModuloSecretaria\Docente;
use App\Models\User;
use App\Models\ModuloSecretaria\Carrera;
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
            ['name' => 'José Durán', 'email' => 'joseduran@example.com'],
            ['name' => 'Armando López', 'email' => 'armandolopez@example.com'],
            ['name' => 'Freddy López', 'email' => 'freddylopez@example.com'],
            ['name' => 'Tobías Solano', 'email' => 'tobiassolano@example.com'],
        ];

        foreach ($docentes as $docente) {
            $user = User::create([
                'name' => $docente['name'],
                'email' => $docente['email'],
                'password' => Hash::make('password'),
            ]);

            Docente::create([
                'usuario_id' => $user->id,
                'carrera_id' => $carrera->id,
            ]);
        }
    }
}