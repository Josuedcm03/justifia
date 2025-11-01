<?php

namespace App\Presentation\Http\Controllers\Estudiante;

use App\Application\Apelaciones\Commands\ActualizarApelacionCommand;
use App\Application\Apelaciones\Commands\CrearApelacionCommand;
use App\Application\Apelaciones\DTOs\ActualizarApelacionDTO;
use App\Application\Apelaciones\DTOs\ApelacionesPorEstudianteDTO;
use App\Application\Apelaciones\DTOs\ApelacionPorSolicitudDTO;
use App\Application\Apelaciones\DTOs\CrearApelacionDTO;
use App\Application\Apelaciones\Handlers\ActualizarApelacionHandler;
use App\Application\Apelaciones\Handlers\CrearApelacionHandler;
use App\Application\Apelaciones\Handlers\ListarApelacionesPorEstudianteHandler;
use App\Application\Apelaciones\Handlers\ObtenerUltimaApelacionDeSolicitudHandler;
use App\Application\Apelaciones\Handlers\ObtenerUltimaApelacionRechazadaHandler;
use App\Application\Apelaciones\Queries\ListarApelacionesPorEstudianteQuery;
use App\Application\Apelaciones\Queries\ObtenerUltimaApelacionDeSolicitudQuery;
use App\Application\Apelaciones\Queries\ObtenerUltimaApelacionRechazadaQuery;
use App\Domain\Shared\Enums\EstadoApelacion;
use App\Presentation\Http\Controllers\Shared\Controller;
use App\Domain\Apelaciones\Entities\Apelacion;
use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Http\Request;

class ApelacionController extends Controller
{
    public function __construct(
        private readonly ListarApelacionesPorEstudianteHandler $listarApelaciones,
        private readonly ObtenerUltimaApelacionDeSolicitudHandler $obtenerUltimaDeSolicitud,
        private readonly ObtenerUltimaApelacionRechazadaHandler $obtenerUltimaRechazada,
        private readonly CrearApelacionHandler $crearApelacion,
        private readonly ActualizarApelacionHandler $actualizarApelacion
    )
    {
    }

    public function index()
    {
        $estudianteId = auth()->user()->estudiante->id;
        $apelaciones = collect($this->listarApelaciones->handle(
            new ListarApelacionesPorEstudianteQuery(new ApelacionesPorEstudianteDTO($estudianteId))
        ))
            ->groupBy(fn($a) => $a->estado->value);

        return view('presentation.estudiante.apelaciones.index', [
            'apelaciones' => $apelaciones,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Solicitud $solicitud)
    {
        $ultimaApelacion = $this->obtenerUltimaDeSolicitud->handle(
            new ObtenerUltimaApelacionDeSolicitudQuery(new ApelacionPorSolicitudDTO($solicitud->id))
        );

        $respuesta = $ultimaApelacion?->respuesta ?? $solicitud->respuesta;

        return view('presentation.estudiante.apelaciones.create', compact('solicitud', 'respuesta'));
    }

    public function store(Request $request, Solicitud $solicitud)
    {
        $observacion = $request->input('observacion_estudiante');

        $ultimaRechazada = $this->obtenerUltimaRechazada->handle(
            new ObtenerUltimaApelacionRechazadaQuery(new ApelacionPorSolicitudDTO($solicitud->id))
        );

        $apelacion = $this->crearApelacion->handle(
            new CrearApelacionCommand(
                new CrearApelacionDTO(
                    $observacion,
                    $solicitud->id,
                    $ultimaRechazada?->id
                )
            )
        );
        
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

        return view('presentation.estudiante.apelaciones.show', [
            'apelacion' => $apelacion,
            'historial' => $historial,
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(int $apelacion)
    {
        return view('presentation.estudiante.apelaciones.edit');
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Solicitud $solicitud, Apelacion $apelacion)
    {
        if ($apelacion->estado !== EstadoApelacion::Pendiente) {
            abort(403);
        }

        $this->actualizarApelacion->handle(
            new ActualizarApelacionCommand(
                new ActualizarApelacionDTO(
                    $apelacion->id,
                    null,
                    null,
                    $request->input('observacion_estudiante')
                )
            )
        );

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