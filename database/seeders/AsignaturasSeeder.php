<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ModuloSecretaria\Asignatura;
use App\Models\ModuloSecretaria\Facultad;

class AsignaturasSeeder extends Seeder
{
    public function run(): void
    {
        $facultades = Facultad::all();
        $asignaturas = [
            'Diseño Web',
            'Ingeniería de Software I',
            'Almacén de Datos',
            'Matemática Básica',
            'Física Aplicada',
            'Comunicación y Lenguaje I',
            'Ingeniería Económica',
            'Contabilidad II',
        ];

        foreach ($asignaturas as $index => $nombre) {
            $facultad = $facultades[$index % $facultades->count()];
            Asignatura::create(['nombre' => $nombre, 'facultad_id' => $facultad->id]);
        }
    }
}