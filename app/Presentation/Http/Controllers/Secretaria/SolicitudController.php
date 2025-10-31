<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Application\Solicitudes\SolicitudService;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Http\Controllers\Controller;
use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Http\Request;

class SolicitudController extends Controller
{
    public function __construct(private readonly SolicitudService $solicitudes)
    {
    }

    public function index(Request $request)
    {
        $estado = EstadoSolicitud::tryFrom($request->query('estado')) ?? EstadoSolicitud::Pendiente;
        $sinPendientes = $estado === EstadoSolicitud::Rechazada;

        $solicitudes = $this->solicitudes->paginateForSecretaria($estado, $sinPendientes, 9);

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
        $estado = EstadoSolicitud::from($request->input('estado'));
        $respuesta = $request->input('respuesta');

        $solicitudEntity = $this->solicitudes->obtenerPorId($solicitud->id);

        $this->solicitudes->actualizarEstado($solicitudEntity, $estado, $respuesta);

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('secretaria.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Solicitud actualizada correctamente.');
    }
}