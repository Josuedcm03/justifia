<x-uam-mail title="Apelación Rechazada" :recipientEmail="$recipientEmail">
<p>Estimado/a {{ $recipientName }},</p>
<p>Lamentamos informarle que su apelación ha sido <strong>rechazada</strong>.</p>
<p><strong>Detalles de la solicitud:</strong></p>
<ul>
    <li><strong>Respuesta: {{ $apelacion->respuesta }}</strong></li>
    <li><strong>Asignatura:</strong> {{ $apelacion->solicitud->asignatura->nombre }}</li>
    <li><strong>Docente:</strong> {{ $apelacion->solicitud->docente->usuario->name }}</li>
    <li><strong>Fecha de ausencia:</strong> {{ $apelacion->solicitud->fecha_ausencia }}</li>
</ul>
<p>Si necesita más información, por favor contacte a la Secretaría Académica o presente una nueva apelación referenciando la anterior a través del sistema.</p>
</x-uam-mail>