<x-uam-mail title="Solicitud Rechazada" :recipientEmail="$recipientEmail">
<p>Estimado/a {{ $recipientName }},</p>
<p>Lamentamos informarle que su solicitud de justificación de inasistencia ha sido <strong>rechazada</strong>.</p>
<p><strong>Detalles de la solicitud:</strong></p>
<ul>
    <li><strong>Respuesta: {{ $solicitud->respuesta }}</strong></li>
    <li><strong>Asignatura:</strong> {{ $solicitud->asignatura->nombre }}</li>
    <li><strong>Docente:</strong> {{ $solicitud->docente->usuario->name }}</li>
    <li><strong>Fecha de ausencia:</strong> {{ $solicitud->fecha_ausencia}}</li>

</ul>
<p>Si necesita más información, por favor contacte a la secretaria académica o presente una apelación al rechazo a través del sistema.</p>
</x-uam-mail>