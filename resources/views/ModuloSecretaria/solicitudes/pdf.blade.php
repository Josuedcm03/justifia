<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; }
        h1, h2 { text-align: center; margin-bottom: 10px; }
        .section { margin-bottom: 15px; }
        .label { font-weight: bold; }
    </style>
</head>
<body>
    <h1>REPORTE DE SOLICITUDES DE JUSTIFICACIÓN</h1>

    <div class="section">
        <p>Facultad: {{ $solicitud->asignatura->carrera->facultad->nombre ?? '' }}</p>
        <p>Universidad Americana (UAM)</p>
        <p>Generado por: Secretaría Académica</p>
        <p>Fecha de generación: {{ \Carbon\Carbon::now()->format('d/m/Y') }}</p>
    </div>

    <h2>DATOS DEL ESTUDIANTE</h2>
    <div class="section">
        <p><span class="label">Nombre completo:</span> {{ $solicitud->estudiante->usuario->name }}</p>
        <p><span class="label">CIF:</span> {{ $solicitud->estudiante->cif }}</p>
        <p><span class="label">Carrera principal:</span> {{ $solicitud->estudiante->carrera->nombre }}</p>
        <p><span class="label">Correo electrónico:</span> {{ $solicitud->estudiante->usuario->email }}</p>
    </div>

    <h2>RESUMEN DE LA SOLICITUD</h2>
    <div class="section">
        <p><span class="label">ID solicitud:</span> {{ $solicitud->id }}</p>
        <p><span class="label">Fecha de envío:</span> {{ $solicitud->created_at }}</p>
        <p><span class="label">Fecha de ausencia:</span> {{ $solicitud->fecha_ausencia }}</p>
        <p><span class="label">Estado actual:</span> {{ ucfirst($solicitud->estado->value) }}</p>
        <p><span class="label">Tipo de constancia adjunta:</span> {{ $solicitud->tipoConstancia->nombre }}</p>
        <p><span class="label">Motivo:</span> {{ $solicitud->observaciones }}</p>
    </div>

    <h2>ACCIONES REALIZADAS POR SECRETARÍA</h2>
    <div class="section">
        <p><span class="label">Fecha de resolución:</span> {{ $solicitud->updated_at->format('d/m/Y') }}</p>
        <p><span class="label">Resolución:</span> Solicitud {{ ucfirst($solicitud->estado->value) }}</p>
        <p><span class="label">Respuesta de la secretaría:</span> {{ $solicitud->respuesta }}</p>
    </div>

    @if($solicitud->reprogramacion)
        <h2>REPROGRAMACIÓN</h2>
        <div class="section">
            <p><span class="label">Fecha de reprogramación:</span> {{ optional($solicitud->reprogramacion->fecha)->format('d/m/Y') }}</p>
            <p><span class="label">Hora:</span> {{ $solicitud->reprogramacion->hora }}</p>
            <p><span class="label">Observaciones:</span> {{ $solicitud->reprogramacion->observaciones }}</p>
            <p><span class="label">Docente responsable:</span> {{ $solicitud->docente->usuario->name }}</p>
        </div>
    @endif

    <h2>CONCLUSIÓN</h2>
    <div class="section">
        <p>{{ auth()->user()->name }}</p>
        <p>Secretaría Académica – UAM</p>
        <p>{{ auth()->user()->email }}</p>
    </div>
</body>
</html>