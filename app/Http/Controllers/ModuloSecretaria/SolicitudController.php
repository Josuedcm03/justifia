<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

// Models
use App\Models\ModuloEstudiante\Solicitud;
use App\Enums\EstadoSolicitud;
use App\Enums\EstadoApelacion;
use Illuminate\Validation\Rules\Enum;

class SolicitudController extends Controller
{
    /**
     * Display a listing of the resource filtered by status.
     */
    public function index(Request $request)
    {
        $estado = EstadoSolicitud::tryFrom($request->query('estado')) ?? EstadoSolicitud::Pendiente;
        $solicitudes = Solicitud::where('estado', $estado)
        ->when($estado === EstadoSolicitud::Rechazada, function ($query) {
                $query->whereDoesntHave('apelaciones', function ($q) {
                    $q->where('estado', EstadoApelacion::Pendiente);
                });
            })
            ->latest()
            ->paginate(9);

        return view('ModuloSecretaria.solicitudes.index', [
            'solicitudes' => $solicitudes,
            'estado' => $estado->value,
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(Solicitud $solicitud)
    {
        $estado = EstadoSolicitud::tryFrom(request()->query('estado')) ?? EstadoSolicitud::Pendiente;
        return view('ModuloSecretaria.solicitudes.show', [
            'solicitud' => $solicitud,
            'estado' => $estado->value,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Solicitud $solicitud)
    {
        $validated = $request->validate([
            'estado' => [new Enum(EstadoSolicitud::class)],
            'respuesta' => ['string'],
        ]);

        $solicitud->estado = EstadoSolicitud::from($validated['estado']);
        $solicitud->respuesta = $validated['respuesta'];
        $solicitud->save();

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('secretaria.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Solicitud actualizada correctamente.');
    }
}
