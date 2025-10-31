<?php

namespace App\Http\Controllers\ModuloDocente;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\ModuloEstudiante\Solicitud;
use App\Models\ModuloDocente\Reprogramacion;
use App\Enums\EstadoAsistencia;
use App\Enums\EstadoSolicitud;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Support\Facades\Mail;
use App\Mail\RescheduleMail;
use Illuminate\Support\Facades\Log;


class ReprogramacionController extends Controller
{
    public function index(Request $request)
    {
        $docenteId = $request->user()->docente->id;

        $solicitudesAReprogramar = Solicitud::where('estado', EstadoSolicitud::Aprobada)
            ->where('docente_id', $docenteId)
            ->doesntHave('reprogramacion')
            ->orderByDesc('id')
            ->get();

        $reprogramaciones = Reprogramacion::whereHas('solicitud', function ($q) use ($docenteId) {
                $q->where('docente_id', $docenteId);
            })
            ->with('solicitud.estudiante.usuario', 'solicitud.asignatura')
            ->orderByDesc('id')
            ->get();

        return view('ModuloDocente.solicitudes.index', compact('solicitudesAReprogramar', 'reprogramaciones'));
    }

    public function show(Solicitud $solicitud)
    {
        $solicitud->load('reprogramacion', 'estudiante.usuario', 'asignatura');
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

        $reprogramacion = Reprogramacion::create($validated);

        $studentUser = $solicitud->estudiante->usuario;

        try {
            Mail::to($studentUser->email)->send(
                new RescheduleMail(
                    $studentUser->name,
                    \Carbon\Carbon::parse($reprogramacion->fecha)->format('d-m-Y'),
                    $reprogramacion->hora,
                    $reprogramacion->observaciones,
                    $studentUser->email
                )
            );
        } catch (\Throwable $e) {
            Log::error('Error enviando correo de reprogramación: ' . $e->getMessage());
        }

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
            ->route('docente.solicitudes.index')
            ->with('success', 'Reprogramación actualizada correctamente.');
    }
}