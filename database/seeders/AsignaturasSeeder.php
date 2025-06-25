<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ModuloSecretaria\Asignatura;

class AsignaturasSeeder extends Seeder
{
    public function run(): void
    {
        $asignaturas = [
            'Diseño Web y Comercio Electrónico',
            'Ingeniería de Software',
            'Ingeniería de Software',
            'Almacén de Datos',
        ];

        foreach ($asignaturas as $nombre) {
            Asignatura::create(['nombre' => $nombre]);
        }
    }
}