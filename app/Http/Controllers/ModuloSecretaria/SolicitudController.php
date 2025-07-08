<?php

namespace App\Http\Controllers\ModuloSecretaria;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

// Models
use App\Models\ModuloEstudiante\Solicitud;
use App\Enums\EstadoSolicitud;
use App\Enums\EstadoApelacion;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use App\Mail\ApprovalMail;
use App\Mail\RejectionMail;

class SolicitudController extends Controller
{
    /**
     * Display a listing of the resource filtered by status.
     */
    public function index(Request $request)
    {
        $estado = EstadoSolicitud::tryFrom($request->query('estado')) ?? EstadoSolicitud::Pendiente;
        $solicitudes = Solicitud::where('estado', $estado)
        ->when($estado === EstadoSolicitud::Rechazada, function ($query) {
                $query->whereDoesntHave('apelaciones', function ($q) {
                    $q->where('estado', EstadoApelacion::Pendiente);
                });
            })
            ->latest()
            ->paginate(9);

        return view('ModuloSecretaria.solicitudes.index', [
            'solicitudes' => $solicitudes,
            'estado' => $estado->value,
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(Solicitud $solicitud)
    {
        $estado = EstadoSolicitud::tryFrom(request()->query('estado')) ?? EstadoSolicitud::Pendiente;
        return view('ModuloSecretaria.solicitudes.show', [
            'solicitud' => $solicitud,
            'estado' => $estado->value,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Solicitud $solicitud)
    {
        $validated = $request->validate([
            'estado' => [new Enum(EstadoSolicitud::class)],
            'respuesta' => ['string'],
        ]);

        $solicitud->estado = EstadoSolicitud::from($validated['estado']);
        $solicitud->respuesta = $validated['respuesta'];
        $solicitud->save();

        $studentUser = $solicitud->estudiante->usuario;
        $teacherUser = $solicitud->docente->usuario;

        try {
            if ($solicitud->estado === EstadoSolicitud::Aprobada) {
                Mail::to($studentUser->email)->send(
                    new ApprovalMail($studentUser->name, $studentUser->email)
                );
                Mail::to($teacherUser->email)->send(
                    new ApprovalMail($teacherUser->name, $teacherUser->email)
                );
            }
            if ($solicitud->estado === EstadoSolicitud::Rechazada) {
                Mail::to($studentUser->email)->send(
                    new RejectionMail($studentUser->name, $solicitud->respuesta, $studentUser->email)
                );
                Mail::to($teacherUser->email)->send(
                    new RejectionMail($teacherUser->name, $solicitud->respuesta, $teacherUser->email)
                );
            }
        } catch (\Throwable $e) {
            Log::error('Error enviando correo de solicitud: ' . $e->getMessage());
        }

        $redirectEstado = $request->query('estado', 'pendiente');

        return redirect()
            ->route('secretaria.solicitudes.index', ['estado' => $redirectEstado])
            ->with('success', 'Solicitud actualizada correctamente.');
    }
}
