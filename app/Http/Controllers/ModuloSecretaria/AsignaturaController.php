<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;

// Models
use App\Models\ModuloSecretaria\Asignatura;
use App\Imports\AsignaturasImport;
use Maatwebsite\Excel\Facades\Excel;
use App\Models\ModuloSecretaria\Facultad;

class AsignaturaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $asignaturas = Asignatura::orderBy('nombre')->paginate(10);
        $asignaturas = Asignatura::with('facultad')->orderBy('nombre')->paginate(10);
        return view('ModuloSecretaria.asignaturas.index', compact('asignaturas'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $facultades = Facultad::orderBy('nombre')->get();
        return view('ModuloSecretaria.asignaturas.create', compact('facultades'));
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
        $facultades = Facultad::orderBy('nombre')->get();
        return view('ModuloSecretaria.asignaturas.edit', compact('asignatura', 'facultades'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Asignatura $asignatura)
    {
        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'facultad_id' => ['required', 'exists:facultades,id'],
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

    public function previewImport(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx'],
        ]);

        $import = new \App\Imports\RowsImport();
        Excel::import($import, $request->file('file'));

        $rows = $import->rows->map(function ($row) {
            return ['nombre' => $row['nombre'] ?? null];
        })->filter(fn ($row) => $row['nombre']);

        $facultades = Facultad::orderBy('nombre')->get();

        return view('ModuloSecretaria.asignaturas.import-preview', compact('rows', 'facultades'));
    }

    public function import(Request $request)
    {
        $rows = $request->input('rows', []);

        foreach ($rows as $row) {
            if (!isset($row['nombre'], $row['facultad_id'])) {
                continue;
            }

            Asignatura::create([
                'nombre' => $row['nombre'],
                'facultad_id' => $row['facultad_id'],
            ]);
        }

        return redirect()->route('secretaria.asignaturas.index')
            ->with('success', 'Asignaturas importadas correctamente.');
    }
}