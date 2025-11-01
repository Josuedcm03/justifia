<?php

namespace Database\Seeders;

use App\Domain\Seguridad\Entities\Role;
use Illuminate\Database\Seeder;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['estudiante', 'docente', 'secretaria'] as $rol) {
            Role::firstOrCreate(['name' => $rol]);
        }
    }
}