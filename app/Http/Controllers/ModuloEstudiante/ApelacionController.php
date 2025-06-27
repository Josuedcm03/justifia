<?php

namespace App\Http\Controllers\ModuloEstudiante;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

// Models
use App\Models\ModuloEstudiante\Apelacion;
use App\Models\ModuloEstudiante\Solicitud;

class ApelacionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return view('ModuloEstudiante.apelaciones.index');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Solicitud $solicitud)
    {
        $ultimaApelacion = Apelacion::where('solicitud_id', $solicitud->id)
            ->latest()
            ->first();

        $respuesta = $ultimaApelacion?->respuesta ?? $solicitud->respuesta;

        return view('ModuloEstudiante.apelaciones.create', compact('solicitud', 'respuesta'));
    }

    public function store(Request $request, Solicitud $solicitud)
    {
        $validated = $request->validate([
            'observacion_estudiante' => ['required', 'string'],
        ]);

        $ultimaRechazada = Apelacion::where('solicitud_id', $solicitud->id)
            ->where('estado', 'rechazada')
            ->latest()
            ->first();

        $data = [
            'observacion' => $validated['observacion_estudiante'],
            'estado' => 'pendiente',
            'solicitud_id' => $solicitud->id,
            'apelacion_id' => $ultimaRechazada?->id,
            'respuesta' => null,
        ];

        Apelacion::create($data);
        
        $redirectEstado = $request->query('estado', 'rechazada');

        return redirect()
            ->route('estudiante.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Apelación enviada correctamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(int $apelacion)
    {
        return view('ModuloEstudiante.apelaciones.show');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(int $apelacion)
    {
        return view('ModuloEstudiante.apelaciones.edit');
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