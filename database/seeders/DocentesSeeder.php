<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ModuloSecretaria\Docente;
use App\Models\User;
use App\Models\ModuloSecretaria\Carrera;
use App\Models\ModuloSeguridad\Role;
use Illuminate\Support\Str;

class DocentesSeeder extends Seeder
{
    public function run(): void
    {
        $carreras = Carrera::all();
        if ($carreras->isEmpty()) {
            return;
        }

        $docenteNames = [
            'Nestor Manuel Avendaño Castellon',
            'Christopher Alberto Baldizón Tinoco',
            'Luvy Jeronima Barquero Vega',
            'Kenneth Joel Fonseca Lupiac',
            'Tobias Adrian Gamboa Solano',
            'Mauricio Antonio Garcia Sotelo',
            'Jose Sebastian Gutiérrez Carballo',
            'Fabiola De Jesus Hernandez Palacios',
            'Hans Jürgen Jahn',
            'Luis Alejandro Jerez Murillo',
            'Esperanza Jiron Balladares',
            'Illiat Lennin Jiron De La Rocha',
            'Ambrosia Del Carmen Lezama Zelaya',
            'Jose Antonio Lezama',
            'Ingrid Yoamy Lopez Blandon',
            'Freddy Luis López Barrios',
            'Ileana Margarita Lopez Briceño',
            'Armando Jose Lopez Lopez',
            'Tatiana María Lorenzo Curbelo',
            'Guadalupe De Los Angeles Martinez Valdivia',
            'Fernanda Marcela Matus Sobalvarro',
            'Carlos Alexander Mendoza Jacomino',
            'Margelia Fátima Montenegro Solórzano',
            'Alejandro Mora Holmann',
            'Carolina Pineda Zeledon',
            'Erick Saul Rios Juarez',
            'Tania Ydith Rivas Morales',
        ];

        $role = Role::where('name', 'docente')->first();

        foreach ($docenteNames as $index => $name) {
            $user = User::create([
                'name' => $name,
                'email' => Str::slug($name, '.') . '@example.com',
                'password' => 'secret',
                'role_id' => $role?->id,
                'email_verified_at' => now(),
            ]);

            Docente::create([
                'usuario_id' => $user->id,
                'carrera_id' => $carreras->random()->id,
                'cif' => sprintf('22010%03d', $index + 1),
            ]);
        }
    }
}
