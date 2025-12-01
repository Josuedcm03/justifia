<?php

namespace App\Presentation\Http\Controllers\Secretaria;

use App\Application\Apelaciones\Commands\ActualizarApelacionCommand;
use App\Application\Apelaciones\DTOs\ActualizarApelacionDTO;
use App\Application\Apelaciones\DTOs\PaginarApelacionesPorEstadoDTO;
use App\Application\Apelaciones\Handlers\ActualizarApelacionHandler;
use App\Application\Apelaciones\Handlers\PaginarApelacionesPorEstadoHandler;
use App\Application\Apelaciones\Queries\PaginarApelacionesPorEstadoQuery;
use App\Application\Solicitudes\Commands\ActualizarEstadoSolicitudCommand;
use App\Application\Solicitudes\DTOs\ActualizarEstadoSolicitudDTO;
use App\Application\Solicitudes\DTOs\SolicitudIdDTO;
use App\Application\Solicitudes\Handlers\ActualizarEstadoSolicitudHandler;
use App\Application\Solicitudes\Handlers\ObtenerSolicitudPorIdHandler;
use App\Application\Solicitudes\Queries\ObtenerSolicitudPorIdQuery;
use App\Domain\Shared\Enums\EstadoApelacion;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Domain\Shared\OptimisticLockException;
use App\Presentation\Http\Controllers\Shared\Controller;
use App\Jobs\SendAppealStatusMail;
use App\Domain\Apelaciones\Entities\Apelacion;
use Illuminate\Http\Request;

class ApelacionController extends Controller
{
    public function __construct(
        private readonly PaginarApelacionesPorEstadoHandler $paginarApelaciones,
        private readonly ActualizarApelacionHandler $actualizarApelacion,
        private readonly ObtenerSolicitudPorIdHandler $obtenerSolicitud,
        private readonly ActualizarEstadoSolicitudHandler $actualizarEstadoSolicitud
    ) {
    }

    public function index(Request $request)
    {
        $estado = EstadoApelacion::tryFrom($request->query('estado')) ?? EstadoApelacion::Pendiente;
        $apelaciones = $this->paginarApelaciones->handle(
            new PaginarApelacionesPorEstadoQuery(new PaginarApelacionesPorEstadoDTO($estado, 9))
        );

        return view('presentation.secretaria.apelaciones.index', [
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

        return view('presentation.secretaria.apelaciones.show', [
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

        try {
            $this->actualizarApelacion->handle(
                new ActualizarApelacionCommand(
                    new ActualizarApelacionDTO($apelacion->id, $estado, $respuesta, null)
                )
            );

            $apelacion->refresh()->load('apelacionPadre', 'solicitud.estudiante.usuario');

            if ($estado === EstadoApelacion::Aprobada) {
                $this->obtenerSolicitud->handle(
                    new ObtenerSolicitudPorIdQuery(new SolicitudIdDTO($apelacion->solicitud->id))
                );
                $this->actualizarEstadoSolicitud->handle(
                    new ActualizarEstadoSolicitudCommand(
                        new ActualizarEstadoSolicitudDTO(
                            $apelacion->solicitud->id,
                            EstadoSolicitud::Aprobada,
                            $respuesta,
                            $apelacion->solicitud->version
                        )
                    )
                );
                $apelacion->refresh()->load('solicitud.estudiante.usuario');
            }
        } catch (OptimisticLockException $exception) {
            return redirect()
                ->back()
                ->with('error', 'La solicitud vinculada fue actualizada por otro usuario. Recarga la página y vuelve a intentar.');
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
