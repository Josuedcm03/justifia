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

        $porCarrera = DB::table('carreras')
            ->leftJoin('estudiantes', 'carreras.id', '=', 'estudiantes.carrera_id')
            ->leftJoin('solicitudes', 'estudiantes.id', '=', 'solicitudes.estudiante_id')
            ->leftJoin('apelaciones', 'solicitudes.id', '=', 'apelaciones.solicitud_id')
            ->select(
                'carreras.nombre as nombre',
                DB::raw('count(distinct solicitudes.id) as solicitudes'),
                DB::raw('count(apelaciones.id) as apelaciones')
            )
            ->groupBy('carreras.id', 'carreras.nombre')
            ->orderBy('carreras.nombre')
            ->get();

        $porFacultad = DB::table('facultades')
            ->leftJoin('carreras', 'facultades.id', '=', 'carreras.facultad_id')
            ->leftJoin('estudiantes', 'carreras.id', '=', 'estudiantes.carrera_id')
            ->leftJoin('solicitudes', 'estudiantes.id', '=', 'solicitudes.estudiante_id')
            ->leftJoin('apelaciones', 'solicitudes.id', '=', 'apelaciones.solicitud_id')
            ->select(
                'facultades.nombre as nombre',
                DB::raw('count(distinct solicitudes.id) as solicitudes'),
                DB::raw('count(apelaciones.id) as apelaciones')
            )
            ->groupBy('facultades.id', 'facultades.nombre')
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