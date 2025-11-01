<?php

namespace App\Application\Seguridad\Handlers;

use App\Application\Seguridad\Commands\RegistrarEstudianteCommand;
use App\Domain\Estudiante\Entities\Estudiante;
use App\Domain\Seguridad\Entities\Role;
use App\Domain\Shared\ValueObjects\EmailInstitucional;
use App\Domain\Usuarios\Entities\User;
use Illuminate\Support\Facades\Hash;

final class RegistrarEstudianteHandler
{
    public function handle(RegistrarEstudianteCommand $command): User
    {
        $payload = $command->payload();

        $role = Role::where('name', 'estudiante')->first();
        $correoInstitucional = (string) new EmailInstitucional($payload->correo());

        $user = User::create([
            'name' => $payload->nombre(),
            'email' => $correoInstitucional,
            'password' => Hash::make($payload->password()),
            'role_id' => $role?->id,
        ]);

        Estudiante::create([
            'cif' => $payload->cif(),
            'usuario_id' => $user->id,
            'carrera_id' => $payload->carreraId(),
        ]);

        return $user;
    }
}
