<?php

namespace App\Presentation\Http\Controllers\Secretaria;

use App\Application\Catalogo\Commands\ActualizarAsignaturaCommand;
use App\Application\Catalogo\Commands\CrearAsignaturaCommand;
use App\Application\Catalogo\Commands\EliminarAsignaturaCommand;
use App\Application\Catalogo\DTOs\ActualizarAsignaturaDTO;
use App\Application\Catalogo\DTOs\AsignaturaIdDTO;
use App\Application\Catalogo\DTOs\CrearAsignaturaDTO;
use App\Application\Catalogo\DTOs\PaginarAsignaturasDTO;
use App\Application\Catalogo\Handlers\ActualizarAsignaturaHandler;
use App\Application\Catalogo\Handlers\CrearAsignaturaHandler;
use App\Application\Catalogo\Handlers\EliminarAsignaturaHandler;
use App\Application\Catalogo\Handlers\ListarFacultadesHandler;
use App\Application\Catalogo\Handlers\ObtenerAsignaturaPorIdHandler;
use App\Application\Catalogo\Handlers\PaginarAsignaturasHandler;
use App\Application\Catalogo\Queries\ListarFacultadesQuery;
use App\Application\Catalogo\Queries\ObtenerAsignaturaPorIdQuery;
use App\Application\Catalogo\Queries\PaginarAsignaturasQuery;
use App\Presentation\Http\Controllers\Shared\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use App\Infraestructure\Imports\AsignaturasImport;

class AsignaturaController extends Controller
{
    public function __construct(
        private readonly PaginarAsignaturasHandler $paginarAsignaturas,
        private readonly CrearAsignaturaHandler $crearAsignatura,
        private readonly ActualizarAsignaturaHandler $actualizarAsignatura,
        private readonly EliminarAsignaturaHandler $eliminarAsignatura,
        private readonly ObtenerAsignaturaPorIdHandler $obtenerAsignatura,
        private readonly ListarFacultadesHandler $listarFacultades,
    ) {
    }

    public function index(Request $request)
    {
        $search = (string) $request->input('search', '');

        $asignaturas = $this->paginarAsignaturas->handle(
            new PaginarAsignaturasQuery(new PaginarAsignaturasDTO($search, 15))
        );

        return view('presentation.secretaria.asignaturas.index', [
            'asignaturas' => $asignaturas,
            'search' => $search,
        ]);
    }

    public function create()
    {
        $facultades = $this->listarFacultades->handle(new ListarFacultadesQuery());

        return view('presentation.secretaria.asignaturas.create', [
            'facultades' => $facultades,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'facultad_id' => ['required', 'integer'],
        ]);

        $this->crearAsignatura->handle(
            new CrearAsignaturaCommand(
                new CrearAsignaturaDTO($validated['nombre'], (int) $validated['facultad_id'])
            )
        );

        return redirect()->route('secretaria.asignaturas.index')
            ->with('success', 'Asignatura creada correctamente.');
    }

    public function edit(int $asignatura)
    {
        $asignaturaEntity = $this->obtenerAsignatura->handle(
            new ObtenerAsignaturaPorIdQuery(new AsignaturaIdDTO($asignatura))
        );
        $facultades = $this->listarFacultades->handle(new ListarFacultadesQuery());

        return view('presentation.secretaria.asignaturas.edit', [
            'asignatura' => $asignaturaEntity,
            'facultades' => $facultades,
        ]);
    }

    public function update(Request $request, int $asignatura)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'facultad_id' => ['required', 'integer'],
        ]);

        $this->actualizarAsignatura->handle(
            new ActualizarAsignaturaCommand(
                new ActualizarAsignaturaDTO($asignatura, $validated['nombre'], (int) $validated['facultad_id'])
            )
        );

        return redirect()->route('secretaria.asignaturas.index')
            ->with('success', 'Asignatura actualizada correctamente.');
    }

    public function destroy(int $asignatura)
    {
        try {
            $this->eliminarAsignatura->handle(
                new EliminarAsignaturaCommand(new AsignaturaIdDTO($asignatura))
            );

            return redirect()->route('secretaria.asignaturas.index')
                ->with('success', 'Asignatura eliminada correctamente.');
        } catch (QueryException) {
            return redirect()->route('secretaria.asignaturas.index')
                ->with('error', 'No se puede eliminar la asignatura porque está asociada a otros registros.');
        }
    }

    public function showImport()
    {
        return view('presentation.secretaria.asignaturas.import');
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx'],
        ]);

        Excel::import(new AsignaturasImport(), $request->file('file'));

        return redirect()->route('secretaria.asignaturas.index')
            ->with('success', 'Asignaturas importadas correctamente.');
    }
}
