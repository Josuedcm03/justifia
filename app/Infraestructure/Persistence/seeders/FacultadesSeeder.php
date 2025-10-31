<?php

namespace Database\Seeders;

use App\Domain\Catalogo\Entities\Carrera;
use App\Domain\Catalogo\Entities\Facultad;
use Illuminate\Database\Seeder;

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