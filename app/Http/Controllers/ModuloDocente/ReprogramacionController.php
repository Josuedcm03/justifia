<?php

namespace App\Http\Controllers\ModuloDocente;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\ModuloEstudiante\Solicitud;
use App\Models\ModuloDocente\Reprogramacion;
use App\Enums\EstadoAsistencia;
use App\Enums\EstadoSolicitud;
use Illuminate\Validation\Rules\Enum;

class ReprogramacionController extends Controller
{
    private int $docenteId = 1; // docente fijo simulado

    public function index()
    {
        $solicitudesAReprogramar = Solicitud::where('estado', EstadoSolicitud::Aprobada)
            ->whereHas('docenteAsignatura', function ($q) {
                $q->where('docente_id', $this->docenteId);
            })
            ->doesntHave('reprogramacion')
            ->orderByDesc('id')
            ->get();

        $reprogramaciones = Reprogramacion::whereHas('solicitud.docenteAsignatura', function ($q) {
                $q->where('docente_id', $this->docenteId);
            })
            ->with('solicitud.estudiante.usuario', 'solicitud.docenteAsignatura.asignatura')
            ->orderByDesc('id')
            ->get();

        return view('ModuloDocente.solicitudes.index', compact('solicitudesAReprogramar', 'reprogramaciones'));
    }

    public function show(Solicitud $solicitud)
    {
        $solicitud->load('reprogramacion', 'estudiante.usuario', 'docenteAsignatura.asignatura');
        return view('ModuloDocente.solicitudes.show', compact('solicitud'));
    }

    public function storeReprogramacion(Request $request, Solicitud $solicitud)
    {
        $validated = $request->validate([
            'fecha' => ['date'],
            'hora' => ['date_format:H:i'],
            'observaciones' => ['nullable', 'string'],
        ]);

        $validated['solicitud_id'] = $solicitud->id;

        Reprogramacion::create($validated);

        return redirect()
            ->route('docente.solicitudes.index')
            ->with('success', 'Reprogramación creada correctamente.');
    }

    public function updateReprogramacion(Request $request, Solicitud $solicitud)
    {
        $validated = $request->validate([
            'fecha' => ['sometimes', 'date'],
            'hora' => ['sometimes', 'date_format:H:i'],
            'asistencia' => ['sometimes', new Enum(EstadoAsistencia::class)],
            'observaciones' => ['nullable', 'string'],
        ]);

        $solicitud->reprogramacion->update($validated);

        return redirect()
            ->route('docente.solicitudes.show', $solicitud)
            ->with('success', 'Reprogramación actualizada correctamente.');
    }
}