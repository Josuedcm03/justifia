<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Apelacion;
use App\Models\Solicitud;

class EstudianteApelacionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return view('estudiante.apelaciones.index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Solicitud $solicitud)
    {
        return view('estudiante.apelaciones.create', compact('solicitud'));
    }

    public function store(Request $request, Solicitud $solicitud)
    {
        $validated = $request->validate([
            'observacion_estudiante' => ['required', 'string'],
            'apelacion_id' => ['nullable', 'exists:apelaciones,id'],
        ]);

        $data = [
            'observacion' => $validated['observacion_estudiante'],
            'estado' => 'pendiente',
            'solicitud_id' => $solicitud->id,
            'apelacion_id' => $validated['apelacion_id'] ?? null,
            'respuesta' => null,
        ];

        Apelacion::create($data);

        return redirect()
            ->route('estudiante.solicitudes.index')
            ->with('success', 'Apelación enviada correctamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(int $apelacion)
    {
        return view('estudiante.apelaciones.show');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(int $apelacion)
    {
        return view('estudiante.apelaciones.edit');
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, int $apelacion)
    {
        return redirect()->route('estudiante.apelaciones.index');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(int $apelacion)
    {
        return redirect()->route('estudiante.apelaciones.index');
    }
}