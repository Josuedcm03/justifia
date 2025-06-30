<?php

namespace App\Http\Controllers\ModuloEstudiante;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

// Models
use App\Models\ModuloEstudiante\Solicitud;
use App\Models\ModuloSecretaria\Docente;
use App\Models\ModuloSecretaria\DocenteAsignatura;
use App\Models\ModuloSecretaria\TipoConstancia;
use App\Enums\EstadoSolicitud;
use App\Enums\EstadoApelacion;
use Illuminate\Validation\Rules\Enum;

class SolicitudController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $estado = EstadoSolicitud::tryFrom($request->query('estado')) ?? EstadoSolicitud::Pendiente;

        $solicitudes = Solicitud::where('estado', $estado)
            ->when(
                $estado === EstadoSolicitud::Rechazada,
                fn($query) => $query->whereDoesntHave('apelaciones')
            )
            ->orderByDesc('id')
            ->paginate(9);

        return view('ModuloEstudiante.solicitudes.index', [
            'solicitudes' => $solicitudes,
            'estado' => $estado->value,
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
    public function store(Request $request)
    {
        $data = $request->all();

        if ($request->hasFile('constancia')) {
            $data['constancia'] = $request->file('constancia')->store('constancias', 'public');
        }

        $data['estado'] = EstadoSolicitud::Pendiente;

        $data['estudiante_id'] = 1;

        Solicitud::create($data);

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('estudiante.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Solicitud creada correctamente.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Solicitud $solicitud)
    {
        $estado = EstadoSolicitud::tryFrom(request()->query('estado')) ?? EstadoSolicitud::Pendiente;
        return view('ModuloEstudiante.solicitudes.show', [
            'solicitud' => $solicitud,
            'estado' => $estado->value,
        ]);
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
    public function update(Request $request, Solicitud $solicitud)
    {
            $data = $request->all();

        if ($request->hasFile('constancia')) {
            if ($solicitud->constancia) {
                Storage::disk('public')->delete($solicitud->constancia);
            }
            $data['constancia'] = $request->file('constancia')->store('constancias', 'public');
            } elseif ($request->boolean('delete_constancia')) {
            if ($solicitud->constancia) {
                Storage::disk('public')->delete($solicitud->constancia);
            }
            $data['constancia'] = null;
        }

        $solicitud->update($data);

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('estudiante.solicitudes.index', ['estado' => $redirectEstado])
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
    public function destroy(Request $request, Solicitud $solicitud)
    {
                if ($solicitud->constancia) {
            Storage::disk('public')->delete($solicitud->constancia);
        }

        $solicitud->delete();

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('estudiante.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Solicitud eliminada correctamente.');
    }
}
