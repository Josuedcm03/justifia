<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\ModuloEstudiante\Apelacion;
use App\Enums\EstadoApelacion;
use App\Enums\EstadoSolicitud;
use Illuminate\Validation\Rules\Enum;

class ApelacionController extends Controller
{
    /**
     * Display a listing of the resource filtered by status.
     */
    public function index(Request $request)
    {
        $estado = EstadoApelacion::tryFrom($request->query('estado')) ?? EstadoApelacion::Pendiente;
        $apelaciones = Apelacion::where('estado', $estado)
            ->whereDoesntHave('apelacionesHijas')
            ->orderByDesc('id')
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
        $estado = EstadoApelacion::tryFrom(request()->query('estado')) ?? EstadoApelacion::Pendiente;
        $apelacion->load('apelacionPadre', 'solicitud');
        $historial = $apelacion->historial();

        return view('ModuloSecretaria.apelaciones.show', [
            'apelacion' => $apelacion,
            'estado' => $estado->value,
            'historial' => $historial,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Apelacion $apelacion)
    {
        $validated = $request->validate([
            'estado' => [new Enum(EstadoApelacion::class)],
            'respuesta' => ['string'],
        ]);

        $apelacion->estado = EstadoApelacion::from($validated['estado']);
        $apelacion->respuesta = $validated['respuesta'];
        $apelacion->save();

        if ($apelacion->estado === EstadoApelacion::Aprobada) {
            $solicitud = $apelacion->solicitud;
            $solicitud->estado = EstadoSolicitud::Aprobada;
            $solicitud->respuesta = $validated['respuesta'];
            $solicitud->save();
        }

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('secretaria.apelaciones.index', ['estado' => $redirectEstado])
            ->with('success', 'Apelación actualizada correctamente.');
    }
}