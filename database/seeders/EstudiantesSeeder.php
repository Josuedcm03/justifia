<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\ModuloEstudiante\Estudiante;
use App\Models\ModuloSecretaria\Carrera;
use App\Models\ModuloSeguridad\Role;

class EstudiantesSeeder extends Seeder
{
    public function run(): void
    {
        $carreras = Carrera::all();
        if ($carreras->isEmpty()) {
            return;
        }

        $role = Role::where('name', 'estudiante')->first();
        $faker = \Faker\Factory::create('es_ES');

        for ($i = 1; $i <= 15; $i++) {
            $user = User::create([
                'name' => $faker->name,
                'email' => $faker->unique()->safeEmail,
                'password' => 'secret',
                'role_id' => $role?->id,
                'email_verified_at' => now(),
            ]);

            Estudiante::create([
                'cif' => sprintf('23020%03d', $i),
                'usuario_id' => $user->id,
                'carrera_id' => $carreras->random()->id,
            ]);
        }
    }
}