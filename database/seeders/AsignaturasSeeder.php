<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\ModuloSecretaria\Asignatura;
use App\Models\ModuloSecretaria\Facultad;

class AsignaturasSeeder extends Seeder
{
    public function run(): void
    {
        $data = [
            'Dirección de Innovación y Emprendimiento' => [
                'Emprendedores',
            ],
            'Dirección Académica' => [
                'Metodología de la Investigación',
            ],
            'Ciencias Médicas' => [
                'Toxicología',
                'Epidemiología',
                'Psiquiatria',
                'Fisiología I',
            ],
            'Facultad de Ingeniería y Arquitectura' => [
                'Matemática Básica',
                'Estadística I',
                'Estadística II',
                'Estudio del Trabajo',
                'Diseño Web',
            ],
            'Ciencias Administrativas y Económicas' => [
                'Principios de Administración',
                'Gestión de Talento Humano',
                'Derecho Empresarial I',
            ],
            'Ciencias Jurídicas, Humanidades y Relaciones Internacionales' => [
                'Derecho de Familia',
                'Introducción al Derecho I',
                'Organizaciones Internacionales I',
            ],
            'Facultad de Marketing' => [
                'Arte Interpretativo',
                'Comunicación y Lenguaje I',
                'Producción de Eventos',
            ],
            'Facultad de Odontología' => [
                'Radiología',
                'Materiales Dentales I',
                'Anestesiología',
                'Clínica de Endodoncia',
            ],
            'Language Center' => [
                'A1 Communicative English',
                'A2+ Communicative English',
                'B1+ Communicative English',
            ],
            'Vida Estudiantil' => [
                'Proyección e Integración Universitaria',
            ],
        ];

        foreach ($data as $facultadNombre => $asignaturas) {
            $facultad = Facultad::firstOrCreate(['nombre' => $facultadNombre]);
            foreach ($asignaturas as $nombre) {
                Asignatura::firstOrCreate([
                    'nombre' => $nombre,
                    'facultad_id' => $facultad->id,
                ]);
            }
        }
    }
}