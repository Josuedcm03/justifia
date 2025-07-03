<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;

// Models
use App\Models\ModuloSecretaria\Facultad;

class FacultadController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $facultades = Facultad::orderBy('nombre')->paginate(10);
        return view('ModuloSecretaria.facultades.index', compact('facultades'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return view('ModuloSecretaria.facultades.create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
        ]);
        Facultad::create($validated);

        return redirect()->route('secretaria.facultades.index')
            ->with('success', 'Facultad creada correctamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Facultad $facultad)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Facultad $facultad)
    {
        return view('ModuloSecretaria.facultades.edit', compact('facultad'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Facultad $facultad)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
        ]);
        $facultad->update($validated);

        return redirect()->route('secretaria.facultades.index')
            ->with('success', 'Facultad actualizada correctamente.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Facultad $facultad)
    {
        try {
            $facultad->delete();
            return redirect()->route('secretaria.facultades.index')
                ->with('success', 'Facultad eliminada correctamente.');
        } catch (QueryException $e) {
            return redirect()->route('secretaria.facultades.index')
                ->with('error', 'No se puede eliminar la facultad porque está asociada a otros registros.');
        }
    }
}