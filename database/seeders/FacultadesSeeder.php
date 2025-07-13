<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ModuloSecretaria\Facultad;
use App\Models\ModuloSecretaria\Carrera;

class FacultadesSeeder extends Seeder
{
    public function run(): void
    {
        $data = [
            'Facultad de Ingeniería y Arquitectura' => [
                'Arquitectura',
                'Ingeniería Civil',
                'Ingeniería Industrial',
                'Ingeniería en Sistemas de Información',
            ],
            'Facultad de Ciencias Médicas' => [
                'Medicina',
                'Psicología',
                'Nutrición',
            ],
            'Facultad de Ciencias Jurídicas. Humanidades y Relaciones Internacionales' => [
                'Derecho',
                'Diplomacia y Relaciones Internacionales',
            ],
            'Facultad de Ciencias Administrativas y Económicas' => [
                'Administración de Empresas',
                'Contabilidad y Finanzas',
                'Economía Empresarial',
                'Negocios Internacionales',
            ],
            'Facultad de Odontología' => [
                'Odontología',
            ],

            'Facultad de Marketing. Diseño y Ciencias de la Comunicación' => [
                'Marketing y Publicidad',
                'Diseño y Comunicación Visual',
                'Comunicación y Relaciones Públicas',
            ],
        ];

        foreach ($data as $nombreFacultad => $carreras) {
            $facultadModel = Facultad::firstOrCreate(['nombre' => $nombreFacultad]);

            foreach ($carreras as $nombreCarrera) {
                Carrera::firstOrCreate([
                    'nombre' => $nombreCarrera,
                    'facultad_id' => $facultadModel->id,
                ]);
            }
        }
    }
}