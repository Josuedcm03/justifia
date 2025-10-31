<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Application\Apelaciones\ApelacionService;
use App\Application\Solicitudes\SolicitudService;
use App\Enums\EstadoApelacion;
use App\Enums\EstadoSolicitud;
use App\Http\Controllers\Controller;
use App\Jobs\SendAppealStatusMail;
use App\Domain\Apelaciones\Entities\Apelacion;
use Illuminate\Http\Request;

class ApelacionController extends Controller
{
    public function __construct(
        private readonly ApelacionService $apelaciones,
        private readonly SolicitudService $solicitudes
    ) {
    }

    public function index(Request $request)
    {
        $estado = EstadoApelacion::tryFrom($request->query('estado')) ?? EstadoApelacion::Pendiente;
        $apelaciones = $this->apelaciones->paginarPorEstado($estado, 9);

        return view('ModuloSecretaria.apelaciones.index', [
            'apelaciones' => $apelaciones,
            'estado' => $estado,
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(Apelacion $apelacion)
    {
        $estado = EstadoApelacion::tryFrom(request()->query('estado')) ?? EstadoApelacion::Pendiente;
        $apelacion->load('apelacionPadre', 'solicitud');
        $historial = $apelacion->historial();

        return view('ModuloSecretaria.apelaciones.show', [
            'apelacion' => $apelacion,
            'estado' => $estado->value,
            'historial' => $historial,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Apelacion $apelacion)
    {
        $estado = EstadoApelacion::from($request->input('estado'));
        $respuesta = $request->input('respuesta');

        $apelacion = $this->apelaciones->actualizar($apelacion, [
            'estado' => $estado,
            'respuesta' => $respuesta,
        ]);

        if ($estado === EstadoApelacion::Aprobada) {
            $this->solicitudes->actualizarEstado($apelacion->solicitud, EstadoSolicitud::Aprobada, $respuesta);
        }

        $studentUser = $apelacion->solicitud->estudiante->usuario;

        SendAppealStatusMail::dispatch(
            $estado === EstadoApelacion::Aprobada,
            $studentUser->email,
            $studentUser->name,
            $apelacion,
        );

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('secretaria.apelaciones.index', ['estado' => $redirectEstado])
            ->with('success', 'Apelación actualizada correctamente.');
    }
}