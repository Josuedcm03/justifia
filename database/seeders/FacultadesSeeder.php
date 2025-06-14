<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Facultad;
use App\Models\Carrera;

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

        foreach ($data as $facultad => $carreras) {
            $facultadModel = Facultad::create(['nombre' => $facultad]);
            foreach ($carreras as $carrera) {
                Carrera::create([
                    'nombre' => $carrera,
                    'facultad_id' => $facultadModel->id,
                ]);
            }
        }
    }
}