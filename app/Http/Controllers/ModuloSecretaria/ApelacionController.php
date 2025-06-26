<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\ModuloEstudiante\Apelacion;

class ApelacionController extends Controller
{
    /**
     * Display a listing of the resource filtered by status.
     */
    public function index(Request $request)
    {
        $estado = $request->query('estado', 'pendiente');
        $apelaciones = Apelacion::where('estado', $estado)
            ->latest()
            ->paginate(9);

        return view('ModuloSecretaria.apelaciones.index', [
            'apelaciones' => $apelaciones,
            'estado' => $estado,
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(Apelacion $apelacion)
    {
        $estado = request()->query('estado', 'pendiente');
        return view('ModuloSecretaria.apelaciones.show', compact('apelacion', 'estado'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Apelacion $apelacion)
    {
        $validated = $request->validate([
            'estado' => ['required', 'in:aprobada,rechazada'],
            'respuesta' => ['nullable', 'string'],
        ]);

        $apelacion->estado = $validated['estado'];
        $apelacion->respuesta = $validated['respuesta'];
        $apelacion->save();

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('secretaria.apelaciones.index', ['estado' => $redirectEstado])
            ->with('success', 'Apelación actualizada correctamente.');
    }
}