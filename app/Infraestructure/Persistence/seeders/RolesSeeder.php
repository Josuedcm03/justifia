<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Domain\Seguridad\Entities\Role;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['estudiante', 'docente', 'secretaria'] as $rol) {
            Role::firstOrCreate(['name' => $rol]);
        }
    }
}