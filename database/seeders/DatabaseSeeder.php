<?php

namespace Database\Seeders;

use App\Domain\Catalogo\Entities\Carrera;
use App\Domain\Catalogo\Entities\Facultad;
use App\Domain\Estudiante\Entities\Estudiante;
use App\Domain\Seguridad\Entities\Role;
use App\Domain\Usuarios\Entities\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        $this->call(RolesSeeder::class);


                $facultad = Facultad::firstOrCreate(['nombre' => 'Facultad']);
        $carrera = Carrera::firstOrCreate([
            'nombre' => 'Carrera',
            'facultad_id' => $facultad->id,
        ]);
        
        $estudianteRole = Role::where('name', 'estudiante')->first();
        $estudianteUser = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'secret',
            'role_id' => $estudianteRole?->id,
            'email_verified_at' => now(),
        ]);

        Estudiante::create([
            'cif' => '22010116',
            'usuario_id' => $estudianteUser->id,
            'carrera_id' => $carrera->id,
        ]);

        $secretariaRole = Role::where('name', 'secretaria')->first();
        User::factory()->create([
            'name' => 'Secretaria',
            'email' => 'secretaria@example.com',
            'password' => 'secret123',
            'role_id' => $secretariaRole?->id,
        ]);

                $this->call([
            FacultadesSeeder::class,
            AsignaturasSeeder::class,
            DocentesSeeder::class,
            TipoConstanciaSeeder::class,
        ]);
    }
}
