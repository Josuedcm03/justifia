<?php

namespace App\Http\Controllers\ModuloDocente;

use App\Application\Reprogramaciones\ReprogramacionService;
use App\Http\Controllers\Controller;
use App\Domain\Solicitud\Entities\Solicitud;
use Illuminate\Http\Request;

class ReprogramacionController extends Controller
{
    public function __construct(private readonly ReprogramacionService $reprogramaciones)
    {
    }

    public function index(Request $request)
    {
        $docenteId = $request->user()->docente->id;
        $solicitudesAReprogramar = $this->reprogramaciones->solicitudesAprobadasSinReprogramar($docenteId);
        $reprogramaciones = $this->reprogramaciones->reprogramacionesPorDocente($docenteId);

        return view('ModuloDocente.solicitudes.index', compact('solicitudesAReprogramar', 'reprogramaciones'));
    }

    public function show(Solicitud $solicitud)
    {
        $solicitud->load('reprogramacion', 'estudiante.usuario', 'asignatura');
        return view('ModuloDocente.solicitudes.show', compact('solicitud'));
    }

    public function storeReprogramacion(Request $request, Solicitud $solicitud)
    {
        $solicitudEntity = $this->reprogramaciones->obtenerSolicitudPorId($solicitud->id);

        $this->reprogramaciones->crear($solicitudEntity, [
            'fecha' => $request->input('fecha'),
            'hora' => $request->input('hora'),
            'observaciones' => $request->input('observaciones'),
        ]);

        return redirect()
            ->route('docente.solicitudes.index')
            ->with('success', 'Reprogramación creada correctamente.');
    }

    public function updateReprogramacion(Request $request, Solicitud $solicitud)
    {
        $reprogramacion = $solicitud->reprogramacion
            ? $this->reprogramaciones->obtenerPorId($solicitud->reprogramacion->id)
            : null;

        if ($reprogramacion) {
            $this->reprogramaciones->actualizar($reprogramacion, [
                'fecha' => $request->input('fecha'),
                'hora' => $request->input('hora'),
                'asistencia' => $request->input('asistencia'),
                'observaciones' => $request->input('observaciones'),
            ]);
        }
        return redirect()
            ->route('docente.solicitudes.index')
            ->with('success', 'Reprogramación actualizada correctamente.');
    }
}