<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

// Models
use App\Models\ModuloEstudiante\Solicitud;

class SolicitudController extends Controller
{
    /**
     * Display a listing of the resource filtered by status.
     */
    public function index(Request $request)
    {
        $estado = $request->query('estado', 'pendiente');
        $solicitudes = Solicitud::where('estado', $estado)
            ->latest()
            ->paginate(9);

        return view('ModuloSecretaria.solicitudes.index', [
            'solicitudes' => $solicitudes,
            'estado' => $estado,
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(Solicitud $solicitud)
    {
        return view('ModuloSecretaria.solicitudes.show', compact('solicitud'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Solicitud $solicitud)
    {
        $validated = $request->validate([
            'estado' => ['required', 'in:aprobada,rechazada'],
            'respuesta' => ['nullable', 'string'],
        ]);

        $solicitud->estado = $validated['estado'];
        $solicitud->respuesta = $validated['estado'] === 'rechazada'
        ? $validated['respuesta']
        : null;
        $solicitud->save();

        return redirect()
            ->route('secretaria.solicitudes.index', ['estado' => 'pendiente'])
            ->with('success', 'Solicitud actualizada correctamente.');
    }
}