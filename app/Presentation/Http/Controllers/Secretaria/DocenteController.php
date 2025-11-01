<?php

namespace App\Presentation\Http\Controllers\Secretaria;

use App\Presentation\Http\Controllers\Shared\Controller;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;

// Models
use App\Domain\Docente\Entities\Docente;
use App\Domain\Seguridad\Entities\Role;
use App\Domain\Usuarios\Entities\User;
use App\Infraestructure\Imports\DocentesImport;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class DocenteController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $search = $request->input('search');

        $docentes = Docente::with('usuario')
            ->when($search, function ($query) use ($search) {
                $query->where('cif', 'like', "%{$search}%")
                    ->orWhereHas('usuario', function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
                    });
            })
            ->orderBy('cif')
            ->paginate(15)
            ->appends(['search' => $search]);

        return view('presentation.secretaria.docentes.index', compact('docentes', 'search'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return view('presentation.secretaria.docentes.create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'cif' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        ]);

        $password = $this->generatePassword($validated['name'], $validated['cif']);

        $role = Role::where('name', 'docente')->first();

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($password),
            'role_id' => $role?->id,
        ]);

        Docente::create([
            'cif' => $validated['cif'],
            'usuario_id' => $user->id,
        ]);

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
        return view('presentation.secretaria.docentes.edit', compact('docente'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Docente $docente)
    {
        $validated = $request->validate([
            'cif' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,' . $docente->usuario_id],
        ]);

        $docente->update([
            'cif' => $validated['cif'],
        ]);

        $docente->usuario?->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
        ]);

        return redirect()->route('secretaria.docentes.index')
            ->with('success', 'Docente actualizado correctamente.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Docente $docente)
    {
        try {
            $docente->delete();
            return redirect()->route('secretaria.docentes.index')
                ->with('success', 'Docente eliminado correctamente.');
        } catch (QueryException $e) {
            return redirect()->route('secretaria.docentes.index')
                ->with('error', 'No se puede eliminar el docente porque está asociado a otros registros.');
        }
    }

    public function showImport()
    {
        return view('presentation.secretaria.docentes.import');
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