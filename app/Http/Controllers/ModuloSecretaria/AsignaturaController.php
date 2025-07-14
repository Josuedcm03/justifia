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
    public function index(Request $request)
    {
        $search = $request->input('search');

        $asignaturas = Asignatura::with('facultad')
            ->when($search, function ($query) use ($search) {
                $query->where('nombre', 'like', "%{$search}%")
                    ->orWhereHas('facultad', function ($q) use ($search) {
                        $q->where('nombre', 'like', "%{$search}%");
                    });
            })
            ->orderBy('nombre')
            ->paginate(15)
            ->appends(['search' => $search]);

        return view('ModuloSecretaria.asignaturas.index', compact('asignaturas', 'search'));
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
        try {
            Asignatura::create([
                'nombre' => $request->input('nombre'),
                'facultad_id' => $request->input('facultad_id'),
            ]);
        } catch (QueryException $e) {
            return back()->with('error', 'No se pudo crear la asignatura.')->withInput();
        }
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
        try {
            $asignatura->update([
                'nombre' => $request->input('nombre'),
                'facultad_id' => $request->input('facultad_id'),
            ]);
        } catch (QueryException $e) {
            return back()->with('error', 'No se pudo actualizar la asignatura.')->withInput();
        }

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