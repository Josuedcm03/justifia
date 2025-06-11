<?php

namespace App\Http\Controllers;

use App\Models\Solicitud;
use App\Models\Docente;
use App\Models\DocenteAsignatura;
use App\Models\tipoConstancia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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

        return view('solicitudes.index', [
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
        $tiposConstancia = tipoConstancia::all();

        return view('solicitudes.create', [
            'docentes' => $docentes,
            'tiposConstancia' => $tiposConstancia,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'fecha_ausencia' => ['required', 'date'],
            'constancia' => ['required', 'file', 'mimes:jpg,jpeg,pdf', 'max:2048'],
            'observaciones' => ['nullable', 'string'],
            'docente_asignatura_id' => ['required', 'exists:docente_asignaturas,id'],
            'tipo_constancia_id' => ['required', 'exists:tipo_constancias,id'],
        ]);

        $filePath = $request->file('constancia')->store('constancias', 'public');

        $validated['constancia'] = $filePath;
        $validated['estado'] = 'pendiente';
        // TODO: replace with the authenticated student's ID when users are implemented
        $validated['estudiante_id'] = 1;

        Solicitud::create($validated);

        return redirect()
            ->route('solicitudes.index')
            ->with('success', 'Solicitud creada correctamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Solicitud $solicitud)
    {
        return view('solicitudes.show', compact('solicitud'));
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Solicitud $solicitud)
    {
        return view('solicitudes.edit', compact('solicitud'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Solicitud $solicitud)
    {
                $validated = $request->validate([
            'fecha_ausencia' => ['required', 'date'],
            'constancia' => ['nullable', 'file', 'mimes:jpg,jpeg,pdf', 'max:2048'],
            'observaciones' => ['nullable', 'string'],
            'estado' => ['required', 'in:pendiente,aprobada,rechazada'],
            'docente_asignatura_id' => ['required', 'exists:docente_asignaturas,id'],
            'tipo_constancia_id' => ['required', 'exists:tipo_constancias,id'],
        ]);

        if ($request->hasFile('constancia')) {
            if ($solicitud->constancia) {
                Storage::disk('public')->delete($solicitud->constancia);
            }
            $filePath = $request->file('constancia')->store('constancias', 'public');
            $validated['constancia'] = $filePath;
        }

        $solicitud->update($validated);

        return redirect()
            ->route('solicitudes.show', $solicitud)
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
            ->route('solicitudes.index')
            ->with('success', 'Solicitud eliminada correctamente.');
    }
}
