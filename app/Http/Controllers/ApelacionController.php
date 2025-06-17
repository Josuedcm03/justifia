<?php

namespace App\Http\Controllers;

use App\Models\Apelacion;
use App\Models\Solicitud;
use Illuminate\Http\Request;

class ApelacionController extends Controller
{
    public function create(Solicitud $solicitud)
    {
        return view('apelaciones.create', compact('solicitud'));
    }

    public function store(Request $request, Solicitud $solicitud)
    {
        $validated = $request->validate([
            'observacion_estudiante' => ['required', 'string'],
            'apelacion_id' => ['nullable', 'exists:apelaciones,id'],
        ]);

        $validated['estado'] = 'pendiente';
        $validated['solicitud_id'] = $solicitud->id;
        $validated['respuesta_secretaria'] = null;

        Apelacion::create($validated);

        return redirect()
            ->route('solicitudes.index')
            ->with('success', 'Apelación enviada correctamente.');
    }
}