<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Application\Apelaciones\Commands\ActualizarApelacionCommand;
use App\Application\Apelaciones\DTOs\ActualizarApelacionDTO;
use App\Application\Apelaciones\DTOs\PaginarApelacionesPorEstadoDTO;
use App\Application\Apelaciones\Handlers\ApelacionService;
use App\Application\Apelaciones\Queries\PaginarApelacionesPorEstadoQuery;
use App\Application\Solicitudes\Commands\ActualizarEstadoSolicitudCommand;
use App\Application\Solicitudes\DTOs\ActualizarEstadoSolicitudDTO;
use App\Application\Solicitudes\DTOs\SolicitudIdDTO;
use App\Application\Solicitudes\Handlers\SolicitudService;
use App\Application\Solicitudes\Queries\ObtenerSolicitudPorIdQuery;
use App\Domain\Shared\Enums\EstadoApelacion;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Http\Controllers\Controller;
use App\Jobs\SendAppealStatusMail;
use App\Domain\Apelaciones\Entities\Apelacion;
use Illuminate\Http\Request;

class ApelacionController extends Controller
{
    public function __construct(
        private readonly ApelacionService $apelaciones,
        private readonly SolicitudService $solicitudes
    ) {
    }

    public function index(Request $request)
    {
        $estado = EstadoApelacion::tryFrom($request->query('estado')) ?? EstadoApelacion::Pendiente;
        $apelaciones = $this->apelaciones->paginarPorEstado(
            new PaginarApelacionesPorEstadoQuery(new PaginarApelacionesPorEstadoDTO($estado, 9))
        );

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
        $estado = EstadoApelacion::from($request->input('estado'));
        $respuesta = $request->input('respuesta');

        $this->apelaciones->actualizar(
            new ActualizarApelacionCommand(
                new ActualizarApelacionDTO($apelacion->id, $estado, $respuesta, null)
            )
        );

        $apelacion->refresh()->load('apelacionPadre', 'solicitud.estudiante.usuario');

        if ($estado === EstadoApelacion::Aprobada) {
            $solicitudEntity = $this->solicitudes->obtenerPorId(
                new ObtenerSolicitudPorIdQuery(new SolicitudIdDTO($apelacion->solicitud->id))
            );
            $this->solicitudes->actualizarEstado(
                new ActualizarEstadoSolicitudCommand(
                    new ActualizarEstadoSolicitudDTO($apelacion->solicitud->id, EstadoSolicitud::Aprobada, $respuesta)
                )
            );
            $apelacion->refresh()->load('solicitud.estudiante.usuario');
        }

        $studentUser = $apelacion->solicitud->estudiante->usuario;

        SendAppealStatusMail::dispatch(
            $estado === EstadoApelacion::Aprobada,
            $studentUser->email,
            $studentUser->name,
            $apelacion,
        );

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('secretaria.apelaciones.index', ['estado' => $redirectEstado])
            ->with('success', 'Apelación actualizada correctamente.');
    }
}