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
            'Ciencias Médicas' => [
                'Medicina',
                'Psicología',
                'Nutrición',
            ],
            'Ciencias Jurídicas, Humanidades y Relaciones Internacionales' => [
                'Derecho',
                'Diplomacia y Relaciones Internacionales',
            ],
            'Ciencias Administrativas y Económicas' => [
                'Administración de Empresas',
                'Contabilidad de Finanzas',
                'Economía Empresarial',
                'Negocios Internacionales',
            ],
            'Facultad de Odontología' => [
                'Odontología',
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