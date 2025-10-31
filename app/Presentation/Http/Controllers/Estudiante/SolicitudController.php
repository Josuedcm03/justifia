<?php

namespace App\Http\Controllers\ModuloEstudiante;

use App\Application\Catalogo\CatalogoService;
use App\Application\Solicitudes\SolicitudService;
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
            $request->user()->estudiante->id,
            $estado,
            9
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
        $docentes = $this->catalogo->docentes();
        $facultades = $this->catalogo->facultades();
        $TiposConstancia = $this->catalogo->tiposConstancia();

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
        $data = $request->all();

        $this->solicitudes->crear(
            $data,
            $request->hasFile('constancia') ? $request->file('constancia') : null,
            $request->user()->estudiante->id
        );

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
        $docentes = $this->catalogo->docentes();
        $facultades = $this->catalogo->facultades();
        $TiposConstancia = $this->catalogo->tiposConstancia();

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
        $data = $request->all();

        $solicitudEntity = $this->solicitudes->obtenerPorId($solicitud->id);

        $this->solicitudes->actualizar(
            $solicitudEntity,
            $data,
            $request->hasFile('constancia') ? $request->file('constancia') : null,
            $request->boolean('delete_constancia')
        );

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
        return response()->json($this->catalogo->asignaturasPorFacultad($facultad->id));
    }

    public function buscarDocentes(Request $request)
    {
        $query = $request->query('q');
        $docentes = $this->catalogo
            ->buscarDocentes($query ?? '')
            ->map(fn($d) => ['id' => $d->id, 'nombre' => $d->usuario->name]);

        return response()->json($docentes);
    }

    public function buscarAsignaturas(Request $request)
    {
        $query = $request->query('q');
        $facultadId = $request->query('facultad');

        $asignaturas = $this->catalogo
            ->buscarAsignaturas($query ?? '', $facultadId)
            ->map(fn($a) => ['id' => $a->id, 'nombre' => $a->nombre]);

        return response()->json($asignaturas);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Solicitud $solicitud)
    {
        $solicitudEntity = $this->solicitudes->obtenerPorId($solicitud->id);

        $this->solicitudes->eliminar($solicitudEntity);

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('estudiante.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Solicitud eliminada correctamente.');
    }
}