<?php

namespace App\Presentation\Http\Controllers\Estudiante;

use App\Application\Catalogo\DTOs\AsignaturasPorFacultadDTO;
use App\Application\Catalogo\DTOs\BuscarAsignaturasDTO;
use App\Application\Catalogo\DTOs\BuscarDocentesDTO;
use App\Application\Catalogo\Handlers\BuscarAsignaturasHandler;
use App\Application\Catalogo\Handlers\BuscarDocentesHandler;
use App\Application\Catalogo\Handlers\ListarAsignaturasPorFacultadHandler;
use App\Application\Catalogo\Handlers\ListarDocentesHandler;
use App\Application\Catalogo\Handlers\ListarFacultadesHandler;
use App\Application\Catalogo\Handlers\ListarTiposConstanciaHandler;
use App\Application\Catalogo\Queries\BuscarAsignaturasQuery;
use App\Application\Catalogo\Queries\BuscarDocentesQuery;
use App\Application\Catalogo\Queries\ListarAsignaturasPorFacultadQuery;
use App\Application\Catalogo\Queries\ListarDocentesQuery;
use App\Application\Catalogo\Queries\ListarFacultadesQuery;
use App\Application\Catalogo\Queries\ListarTiposConstanciaQuery;
use App\Application\Solicitudes\Commands\ActualizarSolicitudCommand;
use App\Application\Solicitudes\Commands\CrearSolicitudCommand;
use App\Application\Solicitudes\Commands\EliminarSolicitudCommand;
use App\Application\Solicitudes\DTOs\ActualizarSolicitudDTO;
use App\Application\Solicitudes\DTOs\CrearSolicitudDTO;
use App\Application\Solicitudes\DTOs\PaginarSolicitudesEstudianteDTO;
use App\Application\Solicitudes\DTOs\SolicitudIdDTO;
use App\Application\Solicitudes\Handlers\ActualizarSolicitudHandler;
use App\Application\Solicitudes\Handlers\CrearSolicitudHandler;
use App\Application\Solicitudes\Handlers\EliminarSolicitudHandler;
use App\Application\Solicitudes\Handlers\PaginarSolicitudesEstudianteHandler;
use App\Application\Solicitudes\Queries\PaginarSolicitudesEstudianteQuery;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Domain\Shared\OptimisticLockException;
use App\Presentation\Http\Controllers\Shared\Controller;
use App\Domain\Catalogo\Entities\Facultad;
use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Http\Request;

class SolicitudController extends Controller
{
    public function __construct(
        private readonly PaginarSolicitudesEstudianteHandler $paginarSolicitudesEstudiante,
        private readonly CrearSolicitudHandler $crearSolicitud,
        private readonly ActualizarSolicitudHandler $actualizarSolicitud,
        private readonly EliminarSolicitudHandler $eliminarSolicitud,
        private readonly ListarDocentesHandler $listarDocentes,
        private readonly ListarFacultadesHandler $listarFacultades,
        private readonly ListarTiposConstanciaHandler $listarTiposConstancia,
        private readonly ListarAsignaturasPorFacultadHandler $listarAsignaturasPorFacultad,
        private readonly BuscarDocentesHandler $buscarDocentes,
        private readonly BuscarAsignaturasHandler $buscarAsignaturas,
    ) {
    }

    public function index(Request $request)
    {
        $estado = EstadoSolicitud::tryFrom($request->query('estado')) ?? EstadoSolicitud::Pendiente;

        $solicitudes = $this->paginarSolicitudesEstudiante->handle(
            new PaginarSolicitudesEstudianteQuery(
                new PaginarSolicitudesEstudianteDTO(
                    $request->user()->estudiante->id,
                    $estado,
                    9
                )
            )
        );

        return view('presentation.estudiante.solicitudes.index', [
            'solicitudes' => $solicitudes,
            'estado' => $estado->value,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $docentes = $this->listarDocentes->handle(new ListarDocentesQuery());
        $facultades = $this->listarFacultades->handle(new ListarFacultadesQuery());
        $TiposConstancia = $this->listarTiposConstancia->handle(new ListarTiposConstanciaQuery());

        return view('presentation.estudiante.solicitudes.create', [
            'docentes' => $docentes,
            'TiposConstancia' => $TiposConstancia,
            'facultades' => $facultades,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $command = new CrearSolicitudCommand(
            new CrearSolicitudDTO(
                (string) $request->input('fecha_ausencia'),
                (int) $request->input('docente_id'),
                (int) $request->input('asignatura_id'),
                (int) $request->input('tipo_constancia_id'),
                $request->input('observaciones'),
                $request->hasFile('constancia') ? $request->file('constancia') : null,
                $request->user()->estudiante->id
            )
        );

        $this->crearSolicitud->handle($command);

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('estudiante.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Solicitud creada correctamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Solicitud $solicitud)
    {
        $estado = EstadoSolicitud::tryFrom(request()->query('estado')) ?? EstadoSolicitud::Pendiente;
        return view('presentation.estudiante.solicitudes.show', [
            'solicitud' => $solicitud,
            'estado' => $estado->value,
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Solicitud $solicitud)
    {
        $docentes = $this->listarDocentes->handle(new ListarDocentesQuery());
        $facultades = $this->listarFacultades->handle(new ListarFacultadesQuery());
        $TiposConstancia = $this->listarTiposConstancia->handle(new ListarTiposConstanciaQuery());

        return view('presentation.estudiante.solicitudes.edit', [
            'solicitud' => $solicitud,
            'docentes' => $docentes,
            'TiposConstancia' => $TiposConstancia,
            'facultades' => $facultades,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Solicitud $solicitud)
    {
        $command = new ActualizarSolicitudCommand(
            new ActualizarSolicitudDTO(
                $solicitud->id,
                (string) $request->input('fecha_ausencia'),
                (int) $request->input('docente_id'),
                (int) $request->input('asignatura_id'),
                (int) $request->input('tipo_constancia_id'),
                $request->input('observaciones'),
                $request->hasFile('constancia') ? $request->file('constancia') : null,
                $request->boolean('delete_constancia'),
                (int) $request->input('version', 0)
            )
        );

        try {
            $this->actualizarSolicitud->handle($command);
        } catch (OptimisticLockException $exception) {
            return redirect()
                ->back()
                ->withInput()
                ->with('error', 'La solicitud fue actualizada por otro usuario. Recarga la página y vuelve a intentar.');
        }

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('estudiante.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Solicitud actualizada correctamente.');
    }

    /**
    * Return asignaturas linked to a facultad.
     */
    public function asignaturasPorFacultad(Facultad $facultad)
    {
        return response()->json(
            $this->listarAsignaturasPorFacultad->handle(
                new ListarAsignaturasPorFacultadQuery(new AsignaturasPorFacultadDTO($facultad->id))
            )
        );
    }

    public function buscarDocentes(Request $request)
    {
        $query = $request->query('q');
        $docentes = collect($this->buscarDocentes->handle(
            new BuscarDocentesQuery(new BuscarDocentesDTO($query ?? '', 10))
        ))
            ->map(fn($d) => ['id' => $d->id, 'nombre' => $d->usuario->name]);

        return response()->json($docentes);
    }

    public function buscarAsignaturas(Request $request)
    {
        $query = $request->query('q');
        $facultadId = $request->query('facultad');

        $asignaturas = collect($this->buscarAsignaturas->handle(
            new BuscarAsignaturasQuery(
                new BuscarAsignaturasDTO($query ?? '', $facultadId ? (int) $facultadId : null, 10)
            )
        ))
            ->map(fn($a) => ['id' => $a->id, 'nombre' => $a->nombre]);

        return response()->json($asignaturas);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Solicitud $solicitud)
    {
        $this->eliminarSolicitud->handle(
            new EliminarSolicitudCommand(new SolicitudIdDTO($solicitud->id))
        );

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('estudiante.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Solicitud eliminada correctamente.');
    }
}
