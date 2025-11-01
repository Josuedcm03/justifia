<?php

namespace App\Presentation\Http\Controllers\Secretaria;

use App\Application\Catalogo\Commands\ActualizarTipoConstanciaCommand;
use App\Application\Catalogo\Commands\CrearTipoConstanciaCommand;
use App\Application\Catalogo\Commands\EliminarTipoConstanciaCommand;
use App\Application\Catalogo\DTOs\ActualizarTipoConstanciaDTO;
use App\Application\Catalogo\DTOs\CrearTipoConstanciaDTO;
use App\Application\Catalogo\DTOs\PaginarTipoConstanciasDTO;
use App\Application\Catalogo\DTOs\TipoConstanciaIdDTO;
use App\Application\Catalogo\Handlers\ActualizarTipoConstanciaHandler;
use App\Application\Catalogo\Handlers\CrearTipoConstanciaHandler;
use App\Application\Catalogo\Handlers\EliminarTipoConstanciaHandler;
use App\Application\Catalogo\Handlers\ObtenerTipoConstanciaPorIdHandler;
use App\Application\Catalogo\Handlers\PaginarTipoConstanciasHandler;
use App\Application\Catalogo\Queries\ObtenerTipoConstanciaPorIdQuery;
use App\Application\Catalogo\Queries\PaginarTipoConstanciasQuery;
use App\Presentation\Http\Controllers\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;

class TipoConstanciaController extends Controller
{
    public function __construct(
        private readonly PaginarTipoConstanciasHandler $paginarTipos,
        private readonly CrearTipoConstanciaHandler $crearTipo,
        private readonly ActualizarTipoConstanciaHandler $actualizarTipo,
        private readonly EliminarTipoConstanciaHandler $eliminarTipo,
        private readonly ObtenerTipoConstanciaPorIdHandler $obtenerTipo,
    ) {
    }

    public function index()
    {
        $tipos = $this->paginarTipos->handle(
            new PaginarTipoConstanciasQuery(new PaginarTipoConstanciasDTO(10))
        );

        return view('ModuloSecretaria.tipos-constancia.index', [
            'tipos' => $tipos,
        ]);
    }

    public function create()
    {
        return view('ModuloSecretaria.tipos-constancia.create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
        ]);

        $this->crearTipo->handle(
            new CrearTipoConstanciaCommand(new CrearTipoConstanciaDTO($validated['nombre']))
        );

        return redirect()->route('secretaria.tipo-constancia.index')
            ->with('success', 'Tipo de constancia creado correctamente.');
    }

    public function edit(int $tipoConstancia)
    {
        $tipo = $this->obtenerTipo->handle(
            new ObtenerTipoConstanciaPorIdQuery(new TipoConstanciaIdDTO($tipoConstancia))
        );

        return view('ModuloSecretaria.tipos-constancia.edit', [
            'tipoConstancia' => $tipo,
        ]);
    }

    public function update(Request $request, int $tipoConstancia)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
        ]);

        $this->actualizarTipo->handle(
            new ActualizarTipoConstanciaCommand(
                new ActualizarTipoConstanciaDTO($tipoConstancia, $validated['nombre'])
            )
        );

        return redirect()->route('secretaria.tipo-constancia.index')
            ->with('success', 'Tipo de constancia actualizado correctamente.');
    }

    public function destroy(int $tipoConstancia)
    {
        try {
            $this->eliminarTipo->handle(
                new EliminarTipoConstanciaCommand(new TipoConstanciaIdDTO($tipoConstancia))
            );

            return redirect()->route('secretaria.tipo-constancia.index')
                ->with('success', 'Tipo de constancia eliminado correctamente.');
        } catch (QueryException) {
            return redirect()->route('secretaria.tipo-constancia.index')
                ->with('error', 'No se puede eliminar el tipo de constancia porque está asociado a otros registros.');
        }
    }
}
