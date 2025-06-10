<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Database\Seeders\FacultadesSeeder;
use Database\Seeders\AsignaturasSeeder;
use Database\Seeders\DocentesSeeder;
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

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
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
