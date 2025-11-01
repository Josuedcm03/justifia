<?php

namespace App\Http\Controllers\ModuloEstudiante;

use App\Application\Catalogo\DTOs\AsignaturasPorFacultadDTO;
use App\Application\Catalogo\DTOs\BuscarAsignaturasDTO;
use App\Application\Catalogo\DTOs\BuscarDocentesDTO;
use App\Application\Catalogo\Handlers\CatalogoService;
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
use App\Application\Solicitudes\Handlers\SolicitudService;
use App\Application\Solicitudes\Queries\PaginarSolicitudesEstudianteQuery;
use App\Domain\Shared\Enums\EstadoSolicitud;
use App\Http\Controllers\Controller;
use App\Domain\Catalogo\Entities\Facultad;
use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Http\Request;

class SolicitudController extends Controller
{
    public function __construct(
        private readonly SolicitudService $solicitudes,
        private readonly CatalogoService $catalogo,
    ) {
    }

    public function index(Request $request)
    {
        $estado = EstadoSolicitud::tryFrom($request->query('estado')) ?? EstadoSolicitud::Pendiente;

        $solicitudes = $this->solicitudes->paginateForEstudiante(
            new PaginarSolicitudesEstudianteQuery(
                new PaginarSolicitudesEstudianteDTO(
                    $request->user()->estudiante->id,
                    $estado,
                    9
                )
            )
        );

        return view('ModuloEstudiante.solicitudes.index', [
            'solicitudes' => $solicitudes,
            'estado' => $estado->value,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $docentes = $this->catalogo->docentes(new ListarDocentesQuery());
        $facultades = $this->catalogo->facultades(new ListarFacultadesQuery());
        $TiposConstancia = $this->catalogo->tiposConstancia(new ListarTiposConstanciaQuery());

        return view('ModuloEstudiante.solicitudes.create', [
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

        $this->solicitudes->crear($command);

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
        return view('ModuloEstudiante.solicitudes.show', [
            'solicitud' => $solicitud,
            'estado' => $estado->value,
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Solicitud $solicitud)
    {
        $docentes = $this->catalogo->docentes(new ListarDocentesQuery());
        $facultades = $this->catalogo->facultades(new ListarFacultadesQuery());
        $TiposConstancia = $this->catalogo->tiposConstancia(new ListarTiposConstanciaQuery());

        return view('ModuloEstudiante.solicitudes.edit', [
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
                $request->boolean('delete_constancia')
            )
        );

        $this->solicitudes->actualizar($command);

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
            $this->catalogo->asignaturasPorFacultad(
                new ListarAsignaturasPorFacultadQuery(new AsignaturasPorFacultadDTO($facultad->id))
            )
        );
    }

    public function buscarDocentes(Request $request)
    {
        $query = $request->query('q');
        $docentes = $this->catalogo
            ->buscarDocentes(
                new BuscarDocentesQuery(new BuscarDocentesDTO($query ?? '', 10))
            )
            ->map(fn($d) => ['id' => $d->id, 'nombre' => $d->usuario->name]);

        return response()->json($docentes);
    }

    public function buscarAsignaturas(Request $request)
    {
        $query = $request->query('q');
        $facultadId = $request->query('facultad');

        $asignaturas = $this->catalogo
            ->buscarAsignaturas(
                new BuscarAsignaturasQuery(
                    new BuscarAsignaturasDTO($query ?? '', $facultadId ? (int) $facultadId : null, 10)
                )
            )
            ->map(fn($a) => ['id' => $a->id, 'nombre' => $a->nombre]);

        return response()->json($asignaturas);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Solicitud $solicitud)
    {
        $this->solicitudes->eliminar(
            new EliminarSolicitudCommand(new SolicitudIdDTO($solicitud->id))
        );

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('estudiante.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Solicitud eliminada correctamente.');
    }
}