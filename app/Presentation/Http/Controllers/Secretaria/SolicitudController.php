<?php

namespace App\Presentation\Http\Controllers\Secretaria;

use App\Application\Solicitudes\Commands\ActualizarEstadoSolicitudCommand;
use App\Application\Solicitudes\DTOs\ActualizarEstadoSolicitudDTO;
use App\Application\Solicitudes\DTOs\PaginarSolicitudesSecretariaDTO;
use App\Application\Solicitudes\Handlers\ActualizarEstadoSolicitudHandler;
use App\Application\Solicitudes\Handlers\PaginarSolicitudesSecretariaHandler;
use App\Application\Solicitudes\Queries\PaginarSolicitudesSecretariaQuery;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Presentation\Http\Controllers\Controller;
use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Http\Request;

class SolicitudController extends Controller
{
    public function __construct(
        private readonly PaginarSolicitudesSecretariaHandler $paginarSolicitudes,
        private readonly ActualizarEstadoSolicitudHandler $actualizarEstado
    )
    {
    }

    public function index(Request $request)
    {
        $estado = EstadoSolicitud::tryFrom($request->query('estado')) ?? EstadoSolicitud::Pendiente;
        $sinPendientes = $estado === EstadoSolicitud::Rechazada;

        $solicitudes = $this->paginarSolicitudes->handle(
            new PaginarSolicitudesSecretariaQuery(
                new PaginarSolicitudesSecretariaDTO($estado, $sinPendientes, 9)
            )
        );

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

        $this->actualizarEstado->handle(
            new ActualizarEstadoSolicitudCommand(
                new ActualizarEstadoSolicitudDTO($solicitud->id, $estado, $respuesta)
            )
        );

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('secretaria.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Solicitud actualizada correctamente.');
    }
}