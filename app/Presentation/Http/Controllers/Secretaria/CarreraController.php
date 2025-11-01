<?php

namespace App\Presentation\Http\Controllers\Secretaria;

use App\Application\Catalogo\Commands\ActualizarCarreraCommand;
use App\Application\Catalogo\Commands\CrearCarreraCommand;
use App\Application\Catalogo\Commands\EliminarCarreraCommand;
use App\Application\Catalogo\DTOs\ActualizarCarreraDTO;
use App\Application\Catalogo\DTOs\CarreraIdDTO;
use App\Application\Catalogo\DTOs\CrearCarreraDTO;
use App\Application\Catalogo\DTOs\PaginarCarrerasDTO;
use App\Application\Catalogo\Handlers\ActualizarCarreraHandler;
use App\Application\Catalogo\Handlers\CrearCarreraHandler;
use App\Application\Catalogo\Handlers\EliminarCarreraHandler;
use App\Application\Catalogo\Handlers\ListarFacultadesHandler;
use App\Application\Catalogo\Handlers\ObtenerCarreraPorIdHandler;
use App\Application\Catalogo\Handlers\PaginarCarrerasHandler;
use App\Application\Catalogo\Queries\ListarFacultadesQuery;
use App\Application\Catalogo\Queries\ObtenerCarreraPorIdQuery;
use App\Application\Catalogo\Queries\PaginarCarrerasQuery;
use App\Presentation\Http\Controllers\Shared\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;

class CarreraController extends Controller
{
    public function __construct(
        private readonly PaginarCarrerasHandler $paginarCarreras,
        private readonly CrearCarreraHandler $crearCarrera,
        private readonly ActualizarCarreraHandler $actualizarCarrera,
        private readonly EliminarCarreraHandler $eliminarCarrera,
        private readonly ObtenerCarreraPorIdHandler $obtenerCarrera,
        private readonly ListarFacultadesHandler $listarFacultades,
    ) {
    }

    public function index()
    {
        $carreras = $this->paginarCarreras->handle(
            new PaginarCarrerasQuery(new PaginarCarrerasDTO(10))
        );

        return view('presentation.secretaria.carreras.index', [
            'carreras' => $carreras,
        ]);
    }

    public function create()
    {
        $facultades = $this->listarFacultades->handle(new ListarFacultadesQuery());

        return view('presentation.secretaria.carreras.create', [
            'facultades' => $facultades,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'facultad_id' => ['required', 'integer'],
        ]);

        $this->crearCarrera->handle(
            new CrearCarreraCommand(
                new CrearCarreraDTO($validated['nombre'], (int) $validated['facultad_id'])
            )
        );

        return redirect()->route('secretaria.carreras.index')
            ->with('success', 'Carrera creada correctamente.');
    }

    public function edit(int $carrera)
    {
        $carreraEntity = $this->obtenerCarrera->handle(
            new ObtenerCarreraPorIdQuery(new CarreraIdDTO($carrera))
        );
        $facultades = $this->listarFacultades->handle(new ListarFacultadesQuery());

        return view('presentation.secretaria.carreras.edit', [
            'carrera' => $carreraEntity,
            'facultades' => $facultades,
        ]);
    }

    public function update(Request $request, int $carrera)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'facultad_id' => ['required', 'integer'],
        ]);

        $this->actualizarCarrera->handle(
            new ActualizarCarreraCommand(
                new ActualizarCarreraDTO($carrera, $validated['nombre'], (int) $validated['facultad_id'])
            )
        );

        return redirect()->route('secretaria.carreras.index')
            ->with('success', 'Carrera actualizada correctamente.');
    }

    public function destroy(int $carrera)
    {
        try {
            $this->eliminarCarrera->handle(
                new EliminarCarreraCommand(new CarreraIdDTO($carrera))
            );

            return redirect()->route('secretaria.carreras.index')
                ->with('success', 'Carrera eliminada correctamente.');
        } catch (QueryException) {
            return redirect()->route('secretaria.carreras.index')
                ->with('error', 'No se puede eliminar la carrera porque está asociada a otros registros.');
        }
    }
}
