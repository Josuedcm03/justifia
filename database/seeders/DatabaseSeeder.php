<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Database\Seeders\FacultadesSeeder;
use Database\Seeders\AsignaturasSeeder;
use Database\Seeders\DocentesSeeder;
use App\Models\Estudiante;
use App\Models\Carrera;
use App\Models\Facultad;
use Database\Seeders\DocenteAsignaturasSeeder;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();


                $facultad = Facultad::firstOrCreate(['nombre' => 'Facultad']);
        $carrera = Carrera::firstOrCreate([
            'nombre' => 'Carrera',
            'facultad_id' => $facultad->id,
        ]);
        
        $estudianteUser = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

                Estudiante::create([
            'cif' => '22010116',
            'usuario_id' => $estudianteUser->id,
            'carrera_id' => $carrera->id,
        ]);


                $this->call([
            FacultadesSeeder::class,
            AsignaturasSeeder::class,
            DocentesSeeder::class,
            tipoConstanciaSeeder::class,
            DocenteAsignaturasSeeder::class,
        ]);
    }
}
