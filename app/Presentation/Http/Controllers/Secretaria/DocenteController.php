<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;

// Models
use App\Models\ModuloSecretaria\Docente;
use App\Imports\DocentesImport;
use Maatwebsite\Excel\Facades\Excel;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use App\Models\ModuloSeguridad\Role;

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
            ->with('success', 'Docente creado correctamente. Contraseña: ' . $password);
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

    private function generatePassword(string $name, string $cif): string
    {
        $initials = implode('', array_map(fn ($part) => strtolower($part[0]), explode(' ', trim($name))));
        $numbers = substr(preg_replace('/\D/', '', $cif), -4);
        $random = random_int(10, 99);

        return $initials . $numbers . $random;
    }
}