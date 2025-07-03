<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;

// Models
use App\Models\ModuloSecretaria\TipoConstancia;

class TipoConstanciaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $tipos = TipoConstancia::orderBy('nombre')->paginate(10);
        return view('ModuloSecretaria.tipos-constancia.index', compact('tipos'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return view('ModuloSecretaria.tipos-constancia.create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
        ]);

        TipoConstancia::create($validated);
        return redirect()->route('secretaria.tipo-constancia.index')
            ->with('success', 'Tipo de constancia creado correctamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(TipoConstancia $TipoConstancia)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(TipoConstancia $TipoConstancia)
    {
        return view('ModuloSecretaria.tipos-constancia.edit', [
            'tipoConstancia' => $TipoConstancia,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, TipoConstancia $TipoConstancia)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
        ]);

        $TipoConstancia->update($validated);

        return redirect()->route('secretaria.tipo-constancia.index')
            ->with('success', 'Tipo de constancia actualizado correctamente.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(TipoConstancia $TipoConstancia)
    {
        try {
            $TipoConstancia->delete();
            return redirect()->route('secretaria.tipo-constancia.index')
                ->with('success', 'Tipo de constancia eliminado correctamente.');
        } catch (QueryException $e) {
            return redirect()->route('secretaria.tipo-constancia.index')
                ->with('error', 'No se puede eliminar el tipo de constancia porque está asociado a otros registros.');
        }
    }
}