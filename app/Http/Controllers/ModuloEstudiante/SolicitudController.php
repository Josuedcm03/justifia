<?php

namespace App\Http\Controllers\ModuloEstudiante;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Http\Requests\Solicitudes\StoreSolicitudRequest;
use App\Http\Requests\Solicitudes\UpdateSolicitudRequest;

// Models
use App\Models\ModuloEstudiante\Solicitud;
use App\Models\ModuloSecretaria\Docente;
use App\Models\ModuloSecretaria\DocenteAsignatura;
use App\Models\ModuloSecretaria\TipoConstancia;

class SolicitudController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $pendientes = Solicitud::where('estado', 'pendiente')
            ->latest()
            ->get();
        $aprobadas = Solicitud::where('estado', 'aprobada')
            ->latest()
            ->get();
        $rechazadas = Solicitud::where('estado', 'rechazada')
            ->latest()
            ->get();

        return view('ModuloEstudiante.solicitudes.index', [
            'pendientes' => $pendientes,
            'aprobadas' => $aprobadas,
            'rechazadas' => $rechazadas,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $docentes = Docente::with('usuario')->get();
        $TiposConstancia = TipoConstancia::all();

        return view('ModuloEstudiante.solicitudes.create', [
            'docentes' => $docentes,
            'TiposConstancia' => $TiposConstancia,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreSolicitudRequest $request)
    {
        $validated = $request->validated();

        $filePath = $request->file('constancia')->store('constancias', 'public');

        $validated['constancia'] = $filePath;
        $validated['estado'] = 'pendiente';
        // TODO: replace with the authenticated student's ID when users are implemented
        $validated['estudiante_id'] = 1;

        Solicitud::create($validated);

        return redirect()
            ->route('estudiante.solicitudes.index')
            ->with('success', 'Solicitud creada correctamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Solicitud $solicitud)
    {
        return view('ModuloEstudiante.solicitudes.show', compact('solicitud'));
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Solicitud $solicitud)
    {
        $docentes = Docente::with('usuario')->get();
        $TiposConstancia = TipoConstancia::all();

        return view('ModuloEstudiante.solicitudes.edit', [
            'solicitud' => $solicitud,
            'docentes' => $docentes,
            'TiposConstancia' => $TiposConstancia,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateSolicitudRequest $request, Solicitud $solicitud)
    {
            $validated = $request->validated();

        if ($request->hasFile('constancia')) {
            if ($solicitud->constancia) {
                Storage::disk('public')->delete($solicitud->constancia);
            }
            $filePath = $request->file('constancia')->store('constancias', 'public');
            $validated['constancia'] = $filePath;
        }

        $solicitud->update($validated);

        return redirect()
            ->route('estudiante.solicitudes.index')
            ->with('success', 'Solicitud actualizada correctamente.');
    }

    /**
     * Return asignaturas linked to a docente.
     */
    public function asignaturasPorDocente(Docente $docente)
    {
        $asignaturas = $docente->asignaturas()
            ->with('asignatura')
            ->get()
            ->map(function (DocenteAsignatura $da) {
                return [
                    'id' => $da->id,
                    'nombre' => $da->asignatura->nombre . ' - Grupo ' . $da->grupo,
                ];
            });

        return response()->json($asignaturas);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Solicitud $solicitud)
    {
                if ($solicitud->constancia) {
            Storage::disk('public')->delete($solicitud->constancia);
        }

        $solicitud->delete();

        return redirect()
            ->route('ModuloEstudiante.solicitudes.index')
            ->with('success', 'Solicitud eliminada correctamente.');
    }
}
