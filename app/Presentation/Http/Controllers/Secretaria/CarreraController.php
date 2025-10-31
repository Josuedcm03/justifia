<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;

// Models
use App\Domain\Catalogo\Entities\Carrera;
use App\Domain\Catalogo\Entities\Facultad;

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
        Carrera::create([
            'nombre' => $request->input('nombre'),
            'facultad_id' => $request->input('facultad_id'),
        ]);
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
        $carrera->update([
            'nombre' => $request->input('nombre'),
            'facultad_id' => $request->input('facultad_id'),
        ]);
        return redirect()->route('secretaria.carreras.index')
            ->with('success', 'Carrera actualizada correctamente.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Carrera $carrera)
    {
        try {
            $carrera->delete();
            return redirect()->route('secretaria.carreras.index')
                ->with('success', 'Carrera eliminada correctamente.');
        } catch (QueryException $e) {
            return redirect()->route('secretaria.carreras.index')
                ->with('error', 'No se puede eliminar la carrera porque está asociada a otros registros.');
        }
    }
}