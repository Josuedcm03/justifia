<?php

namespace App\Http\Controllers\ModuloDocente;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\ModuloEstudiante\Solicitud;
use App\Models\ModuloDocente\Reprogramacion;
use App\Enums\EstadoSolicitud;
use Illuminate\Support\Facades\Mail;
use App\Mail\RescheduleMail;


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
        $reprogramacion = Reprogramacion::create([
            'fecha' => $request->input('fecha'),
            'hora' => $request->input('hora'),
            'observaciones' => $request->input('observaciones'),
            'solicitud_id' => $solicitud->id,
        ]);

        
        $studentUser = $solicitud->estudiante->usuario;

        Mail::to($studentUser->email)->send(
            new RescheduleMail(
                $studentUser->name,
                \Carbon\Carbon::parse($reprogramacion->fecha)->format('d-m-Y'),
                $reprogramacion->hora,
                'Por definir',
                $studentUser->email
            )
        );

        return redirect()
            ->route('docente.solicitudes.index')
            ->with('success', 'Reprogramación creada correctamente.');
    }

    public function updateReprogramacion(Request $request, Solicitud $solicitud)
    {
        $solicitud->reprogramacion->update([
            'fecha' => $request->input('fecha'),
            'hora' => $request->input('hora'),
            'asistencia' => $request->input('asistencia'),
            'observaciones' => $request->input('observaciones'),
        ]);
        return redirect()
            ->route('docente.solicitudes.index', $solicitud)
            ->with('success', 'Reprogramación actualizada correctamente.');
    }
}