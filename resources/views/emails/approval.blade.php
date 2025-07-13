<x-uam-mail title="Solicitud Aprobada" :recipientEmail="$recipientEmail">
<p>Estimado/a {{ $recipientName }},</p>
<p>Le informamos que su solicitud de justificación de inasistencia ha sido <strong>aprobada</strong>.</p>
<p><strong>Detalles de la solicitud:</strong></p>
<ul>
    <li><strong>Respuesta: {{ $solicitud->respuesta }}</strong></li>
    <li><strong>Asignatura:</strong> {{ $solicitud->asignatura->nombre }}</li>
    <li><strong>Docente:</strong> {{ $solicitud->docente->usuario->name }}</li>
    <li><strong>Fecha de ausencia:</strong> {{ $solicitud->fecha_ausencia}}</li>
</ul>
<p>Le pedimos estar atento(a) a la recepción de los datos de la reprogramación por este mismo medio. Para cualquier aclaración adicional, puede comunicarse con su docente o con la secretaría académica.</p>
</x-uam-mail>