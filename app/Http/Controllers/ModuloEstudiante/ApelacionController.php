<?php

namespace App\Http\Controllers\ModuloEstudiante;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

// Models
use App\Models\ModuloEstudiante\Apelacion;
use App\Models\ModuloEstudiante\Solicitud;
use App\Enums\EstadoApelacion;
use App\Enums\EstadoSolicitud;
use Illuminate\Validation\Rules\Enum;

class ApelacionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $apelaciones = Apelacion::whereDoesntHave('apelacionesHijas')
            ->orderByDesc('id')
            ->get()
            ->groupBy(fn ($a) => $a->estado->value);

        return view('ModuloEstudiante.apelaciones.index', [
            'apelaciones' => $apelaciones,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Solicitud $solicitud)
    {
        $ultimaApelacion = Apelacion::where('solicitud_id', $solicitud->id)
            ->orderByDesc('id')
            ->first();

        $respuesta = $ultimaApelacion?->respuesta ?? $solicitud->respuesta;

        return view('ModuloEstudiante.apelaciones.create', compact('solicitud', 'respuesta'));
    }

    public function store(Request $request, Solicitud $solicitud)
    {
        $validated = $request->validate([
            'observacion_estudiante' => ['string'],
        ]);

        $ultimaRechazada = Apelacion::where('solicitud_id', $solicitud->id)
            ->where('estado', EstadoApelacion::Rechazada)
            ->orderByDesc('id')
            ->first();

        $data = [
            'observacion' => $validated['observacion_estudiante'],
            'estado' => EstadoApelacion::Pendiente,
            'solicitud_id' => $solicitud->id,
            'apelacion_id' => $ultimaRechazada?->id,
            'respuesta' => null,
        ];

        $apelacion = Apelacion::create($data);
        
        $redirectEstado = $request->query('estado', 'rechazada');
    
        return redirect()
            ->route('estudiante.apelaciones.index', $apelacion)
            ->with('success', 'Apelación enviada correctamente.');
    }


    /**
     * Display the specified resource.
     */
    public function show(Apelacion $apelacion)
    {
        $apelacion->load('apelacionPadre', 'solicitud');
        $historial = $apelacion->historial();

        return view('ModuloEstudiante.apelaciones.show', [
            'apelacion' => $apelacion,
            'historial' => $historial,
        ]);
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
    public function update(Request $request, Solicitud $solicitud, Apelacion $apelacion)
    {
        if ($apelacion->estado !== EstadoApelacion::Pendiente) {
            abort(403);
        }

        $validated = $request->validate([
            'observacion_estudiante' => ['string'],
        ]);

        $apelacion->observacion = $validated['observacion_estudiante'];
        $apelacion->save();

        return redirect()
            ->route('estudiante.apelaciones.index')
            ->with('success', 'Apelación actualizada correctamente.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(int $apelacion)
    {
        return redirect()->route('estudiante.apelaciones.index');
    }
}