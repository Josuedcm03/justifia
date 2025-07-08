<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use App\Models\ModuloEstudiante\Solicitud;
use App\Models\ModuloEstudiante\Apelacion;
use App\Enums\EstadoSolicitud;
use App\Enums\EstadoApelacion;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats()
    {
        $solicitudes = [
            'aprobadas' => Solicitud::where('estado', EstadoSolicitud::Aprobada)->count(),
            'rechazadas' => Solicitud::where('estado', EstadoSolicitud::Rechazada)->count(),
            'pendientes' => Solicitud::where('estado', EstadoSolicitud::Pendiente)->count(),
        ];

        $apelaciones = [
            'aprobadas' => Apelacion::where('estado', EstadoApelacion::Aprobada)->count(),
            'rechazadas' => Apelacion::where('estado', EstadoApelacion::Rechazada)->count(),
            'pendientes' => Apelacion::where('estado', EstadoApelacion::Pendiente)->count(),
        ];

        $porCarrera = DB::table('solicitudes')
            ->join('estudiantes', 'solicitudes.estudiante_id', '=', 'estudiantes.id')
            ->join('carreras', 'estudiantes.carrera_id', '=', 'carreras.id')
            ->select('carreras.nombre as nombre', DB::raw('count(*) as total'))
            ->groupBy('carreras.nombre')
            ->orderBy('carreras.nombre')
            ->get();

        $porFacultad = DB::table('solicitudes')
            ->join('estudiantes', 'solicitudes.estudiante_id', '=', 'estudiantes.id')
            ->join('carreras', 'estudiantes.carrera_id', '=', 'carreras.id')
            ->join('facultades', 'carreras.facultad_id', '=', 'facultades.id')
            ->select('facultades.nombre as nombre', DB::raw('count(*) as total'))
            ->groupBy('facultades.nombre')
            ->orderBy('facultades.nombre')
            ->get();

        return response()->json([
            'solicitudes' => $solicitudes,
            'apelaciones' => $apelaciones,
            'carreras' => $porCarrera,
            'facultades' => $porFacultad,
        ]);
    }
}