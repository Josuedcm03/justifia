<x-uam-mail title="Apelación Aceptada" :recipientEmail="$recipientEmail">
<p>Estimado/a {{ $recipientName }},</p>
<p>Le informamos que su apelación ha sido <strong>aceptada</strong> y por ende, su solicitud de justificación también fue aprobada.</p>
<p><strong>Detalles de la solicitud:</strong></p>
<ul>
    <li><strong>Respuesta: {{ $apelacion->respuesta }}</strong></li>
    <li><strong>Asignatura:</strong> {{ $apelacion->solicitud->asignatura->nombre }}</li>
    <li><strong>Docente:</strong> {{ $apelacion->solicitud->docente->usuario->name }}</li>
    <li><strong>Fecha de ausencia:</strong> {{ $apelacion->solicitud->fecha_ausencia }}</li>
</ul>
<p>Le pedimos estar atento(a) a la recepción de los datos de la reprogramación por este mismo medio. Para cualquier aclaración adicional, puede comunicarse con su docente o con la secretaría académica.</p>
</x-uam-mail>