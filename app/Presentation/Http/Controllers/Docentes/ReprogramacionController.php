<?php

namespace App\Presentation\Http\Controllers\Docentes;

use App\Application\Reprogramaciones\Commands\ActualizarReprogramacionCommand;
use App\Application\Reprogramaciones\Commands\CrearReprogramacionCommand;
use App\Application\Reprogramaciones\DTOs\ActualizarReprogramacionDTO;
use App\Application\Reprogramaciones\DTOs\CrearReprogramacionDTO;
use App\Application\Reprogramaciones\DTOs\DocenteIdDTO;
use App\Application\Reprogramaciones\Handlers\ActualizarReprogramacionHandler;
use App\Application\Reprogramaciones\Handlers\CrearReprogramacionHandler;
use App\Application\Reprogramaciones\Handlers\ReprogramacionesPorDocenteHandler;
use App\Application\Reprogramaciones\Handlers\SolicitudesAprobadasSinReprogramarHandler;
use App\Application\Reprogramaciones\Queries\ReprogramacionesPorDocenteQuery;
use App\Application\Reprogramaciones\Queries\SolicitudesAprobadasSinReprogramarQuery;
use App\Presentation\Http\Controllers\Controller;
use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Http\Request;
use App\Domain\Shared\Enums\EstadoAsistencia;

class ReprogramacionController extends Controller
{
    public function __construct(
        private readonly SolicitudesAprobadasSinReprogramarHandler $solicitudesSinReprogramar,
        private readonly ReprogramacionesPorDocenteHandler $reprogramacionesPorDocente,
        private readonly CrearReprogramacionHandler $crearReprogramacion,
        private readonly ActualizarReprogramacionHandler $actualizarReprogramacion
    )
    {
    }

    public function index(Request $request)
    {
        $docenteId = $request->user()->docente->id;
        $solicitudesAReprogramar = $this->solicitudesSinReprogramar->handle(
            new SolicitudesAprobadasSinReprogramarQuery(new DocenteIdDTO($docenteId))
        );
        $reprogramaciones = $this->reprogramacionesPorDocente->handle(
            new ReprogramacionesPorDocenteQuery(new DocenteIdDTO($docenteId))
        );

        return view('ModuloDocente.solicitudes.index', compact('solicitudesAReprogramar', 'reprogramaciones'));
    }

    public function show(Solicitud $solicitud)
    {
        $solicitud->load('reprogramacion', 'estudiante.usuario', 'asignatura');
        return view('ModuloDocente.solicitudes.show', compact('solicitud'));
    }

    public function storeReprogramacion(Request $request, Solicitud $solicitud)
    {
        $this->crearReprogramacion->handle(
            new CrearReprogramacionCommand(
                new CrearReprogramacionDTO(
                    $solicitud->id,
                    (string) $request->input('fecha'),
                    (string) $request->input('hora'),
                    $request->input('observaciones')
                )
            )
        );

        return redirect()
            ->route('docente.solicitudes.index')
            ->with('success', 'Reprogramación creada correctamente.');
    }

    public function updateReprogramacion(Request $request, Solicitud $solicitud)
    {
        if ($solicitud->reprogramacion) {
            $asistencia = $request->filled('asistencia')
                ? EstadoAsistencia::from($request->input('asistencia'))
                : null;

            $this->actualizarReprogramacion->handle(
                new ActualizarReprogramacionCommand(
                    new ActualizarReprogramacionDTO(
                        $solicitud->reprogramacion->id,
                        $request->input('fecha'),
                        $request->input('hora'),
                        $request->input('observaciones'),
                        $asistencia
                    )
                )
            );
        }
        return redirect()
            ->route('docente.solicitudes.index')
            ->with('success', 'Reprogramación actualizada correctamente.');
    }
}