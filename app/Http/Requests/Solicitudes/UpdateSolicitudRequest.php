<?php

namespace App\Http\Requests\Solicitudes;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSolicitudRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'fecha_ausencia' => ['required', 'date', 'before_or_equal:today'],
            'constancia' => ['nullable', 'file', 'mimes:jpg,jpeg,pdf', 'max:2048'],
            'observaciones' => ['nullable', 'string'],
            'docente_asignatura_id' => ['required', 'exists:docente_asignaturas,id'],
            'tipo_constancia_id' => ['required', 'exists:tipo_constancias,id'],
        ];
    }
}