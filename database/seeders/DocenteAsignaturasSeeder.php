<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ModuloSecretaria\Docente;
use App\Models\ModuloSecretaria\Asignatura;
use App\Models\ModuloSecretaria\DocenteAsignatura;

class DocenteAsignaturasSeeder extends Seeder
{
    public function run(): void
    {
        $map = [
            'José Durán' => [
                ['asignatura' => 'Diseño Web y Comercio Electrónico', 'grupo' => '1'],
                ['asignatura' => 'Diseño Web y Comercio Electrónico', 'grupo' => '2'],
            ],
            'Armando López' => [
                ['asignatura' => 'Ingeniería de Software', 'grupo' => '1'],
                ['asignatura' => 'Ingeniería de Software', 'grupo' => '2'],
            ],
            'Freddy López' => [
                ['asignatura' => 'Almacén de Datos', 'grupo' => '2'],
            ],
            'Tobías Solano' => [
                ['asignatura' => 'Almacén de Datos', 'grupo' => '1'],
            ],
        ];

        foreach ($map as $docenteNombre => $asignaturas) {
            $docente = Docente::whereHas('usuario', function ($q) use ($docenteNombre) {
                $q->where('name', $docenteNombre);
            })->first();
            if (!$docente) {
                continue;
            }
            foreach ($asignaturas as $info) {
                $asignatura = Asignatura::where('nombre', $info['asignatura'])->first();
                if (!$asignatura) {
                    continue;
                }
                DocenteAsignatura::create([
                    'grupo' => $info['grupo'],
                    'docente_id' => $docente->id,
                    'asignatura_id' => $asignatura->id,
                ]);
            }
        }
    }
}