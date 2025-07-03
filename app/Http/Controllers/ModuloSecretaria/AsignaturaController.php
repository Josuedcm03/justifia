<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;

// Models
use App\Models\ModuloSecretaria\Asignatura;
use App\Imports\AsignaturasImport;
use Maatwebsite\Excel\Facades\Excel;

class AsignaturaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $asignaturas = Asignatura::orderBy('nombre')->paginate(10);
        return view('ModuloSecretaria.asignaturas.index', compact('asignaturas'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return view('ModuloSecretaria.asignaturas.create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
        ]);

        Asignatura::create($validated);
        return redirect()->route('secretaria.asignaturas.index')
            ->with('success', 'Asignatura creada correctamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Asignatura $asignatura)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Asignatura $asignatura)
    {
        return view('ModuloSecretaria.asignaturas.edit', compact('asignatura'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Asignatura $asignatura)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
        ]);
        $asignatura->update($validated);

        return redirect()->route('secretaria.asignaturas.index')
            ->with('success', 'Asignatura actualizada correctamente.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Asignatura $asignatura)
    {
        try {
            $asignatura->delete();
            return redirect()->route('secretaria.asignaturas.index')
                ->with('success', 'Asignatura eliminada correctamente.');
        } catch (QueryException $e) {
            return redirect()->route('secretaria.asignaturas.index')
                ->with('error', 'No se puede eliminar la asignatura porque está asociada a otros registros.');
        }
    }

    public function showImport()
    {
        return view('ModuloSecretaria.asignaturas.import');
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