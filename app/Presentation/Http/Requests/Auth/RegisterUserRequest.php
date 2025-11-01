<?php

namespace App\Presentation\Http\Requests\Auth;

use App\Application\Seguridad\DTOs\RegistrarEstudianteDTO;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules;

final class RegisterUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string|\Illuminate\Validation\Rules\Password>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                'unique:users,email',
                'regex:/^[^@\s]+@uamv\.edu\.ni$/i',
            ],
            'cif' => ['required', 'numeric', 'digits:8', 'unique:estudiantes,cif'],
            'carrera_id' => ['required', 'exists:carreras,id'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ];
    }

    public function toDto(): RegistrarEstudianteDTO
    {
        return new RegistrarEstudianteDTO(
            (string) $this->string('name'),
            (string) $this->string('email'),
            (string) $this->string('cif'),
            $this->integer('carrera_id'),
            (string) $this->string('password'),
        );
    }
}
