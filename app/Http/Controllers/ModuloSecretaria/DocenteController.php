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
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use App\Models\ModuloSeguridad\Role;
use Illuminate\Support\Facades\Mail;
use App\Mail\DocenteCredentialsMail;

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

        return view('ModuloSecretaria.docentes.index', compact('docentes', 'search'));
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
        try {
            $role = Role::where('name', 'docente')->first();

        $user = User::create([
                'name' => $request->input('name'),
                'email' => $request->input('email'),
                'password' => Str::random(40),
                'role_id' => $role?->id,
            ]);

        Docente::create([
                'cif' => $request->input('cif'),
                'usuario_id' => $user->id,
            ]);
        } catch (QueryException $e) {
            return back()->with('error', 'No se pudo crear el docente.')->withInput();
        }

        Mail::to($user->email)->queue(
            new DocenteCredentialsMail($user->name, $user->email)
        );

        $token = Password::broker()->createToken($user);
        $user->sendPasswordResetNotification($token);

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
        try {
            $docente->update([
                'cif' => $request->input('cif'),
            ]);

        $docente->usuario?->update([
                'name' => $request->input('name'),
                'email' => $request->input('email'),
            ]);
        } catch (QueryException $e) {
            return back()->with('error', 'No se pudo actualizar el docente.')->withInput();
        }

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

    public function previewImport(Request $request)
    {
        $import = new \App\Imports\RowsImport();
        Excel::import($import, $request->file('file'));

        $rows = $import->rows->map(function ($row) {
            return [
                'cif' => $row['cif'] ?? null,
                'name' => $row['name'] ?? null,
                'email' => $row['email'] ?? null,
            ];
        })->filter(fn ($row) => $row['cif'] && $row['name'] && $row['email']);

        return view('ModuloSecretaria.docentes.import-preview', compact('rows'));
    }

    public function import(Request $request)
    {
        $rows = $request->input('rows', []);

        foreach ($rows as $row) {
            if (!isset($row['cif'], $row['name'], $row['email'])) {
                continue;
            }

            $role = Role::where('name', 'docente')->first();

            $user = User::create([
                'name' => $row['name'],
                'email' => $row['email'],
                'password' => Str::random(40),
                'role_id' => $role?->id,
            ]);

            Docente::create([
                'cif' => $row['cif'],
                'usuario_id' => $user->id,
            ]);

            Mail::to($user->email)->queue(
                new DocenteCredentialsMail($user->name, $user->email)
            );

            $token = Password::broker()->createToken($user);
            $user->sendPasswordResetNotification($token);
        }

        return redirect()->route('secretaria.docentes.index')
            ->with('success', 'Docentes importados correctamente.');
    }

}