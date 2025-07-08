<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ModuloEstudiante\Solicitud;
use App\Models\ModuloEstudiante\Estudiante;
use App\Models\ModuloSecretaria\Docente;
use App\Models\ModuloSecretaria\Asignatura;
use App\Models\ModuloSecretaria\TipoConstancia;
use App\Enums\EstadoSolicitud;

class SolicitudesSeeder extends Seeder
{
    public function run(): void
    {
        $estudiantes = Estudiante::all();
        $docentes = Docente::all();
        $asignaturas = Asignatura::all();
        $tipos = TipoConstancia::all();

        if ($estudiantes->isEmpty() || $docentes->isEmpty() || $asignaturas->isEmpty() || $tipos->isEmpty()) {
            return;
        }

        $faker = \Faker\Factory::create('es_ES');

        for ($i = 0; $i < 25; $i++) {
            Solicitud::create([
                'fecha_ausencia' => $faker->dateTimeBetween('-1 month', 'now'),
                'constancia' => 'pdf',
                'observaciones' => $faker->sentence(),
                'estado' => EstadoSolicitud::Pendiente,
                'estudiante_id' => $estudiantes->random()->id,
                'docente_id' => $docentes->random()->id,
                'asignatura_id' => $asignaturas->random()->id,
                'tipo_constancia_id' => $tipos->random()->id,
            ]);
        }
    }
}