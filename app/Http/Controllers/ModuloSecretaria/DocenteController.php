<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

// Models
use App\Models\ModuloSecretaria\Docente;
use App\Imports\DocentesImport;
use Maatwebsite\Excel\Facades\Excel;

class DocenteController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $docentes = Docente::orderBy('cif')->paginate(10);
        return view('ModuloSecretaria.docentes.index', compact('docentes'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return view('ModuloSecretaria.docentes.create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'cif' => ['required', 'string', 'max:255'],
        ]);
        Docente::create($validated);

        return redirect()->route('secretaria.docentes.index')
            ->with('success', 'Docente creado correctamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Docente $docente)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Docente $docente)
    {
        return view('ModuloSecretaria.docentes.edit', compact('docente'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Docente $docente)
    {
        $validated = $request->validate([
            'cif' => ['required', 'string', 'max:255'],
        ]);
        $docente->update($validated);

        return redirect()->route('secretaria.docentes.index')
            ->with('success', 'Docente actualizado correctamente.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Docente $docente)
    {
        $docente->delete();
        return redirect()->route('secretaria.docentes.index')
            ->with('success', 'Docente eliminado correctamente.');
    }

    public function showImport()
    {
        return view('ModuloSecretaria.docentes.import');
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx'],
        ]);

        Excel::import(new DocentesImport(), $request->file('file'));

        return redirect()->route('secretaria.docentes.index')
            ->with('success', 'Docentes importados correctamente.');
    }
}