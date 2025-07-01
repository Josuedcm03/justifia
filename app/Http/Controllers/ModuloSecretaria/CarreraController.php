<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

// Models
use App\Models\ModuloSecretaria\Carrera;
use App\Models\ModuloSecretaria\Facultad;

class CarreraController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $carreras = Carrera::with('facultad')->orderBy('nombre')->paginate(10);
        return view('ModuloSecretaria.carreras.index', compact('carreras'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $facultades = Facultad::orderBy('nombre')->get();
        return view('ModuloSecretaria.carreras.create', compact('facultades'));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'facultad_id' => ['required', 'exists:facultades,id'],
        ]);
        Carrera::create($validated);
        return redirect()->route('secretaria.carreras.index')
            ->with('success', 'Carrera creada correctamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Carrera $carrera)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Carrera $carrera)
    {
        $facultades = Facultad::orderBy('nombre')->get();
        return view('ModuloSecretaria.carreras.edit', compact('carrera','facultades'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Carrera $carrera)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'facultad_id' => ['required', 'exists:facultades,id'],
        ]);
        $carrera->update($validated);
        return redirect()->route('secretaria.carreras.index')
            ->with('success', 'Carrera actualizada correctamente.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Carrera $carrera)
    {
        $carrera->delete();
        return redirect()->route('secretaria.carreras.index')
            ->with('success', 'Carrera eliminada correctamente.');
    }
}