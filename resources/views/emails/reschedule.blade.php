<x-uam-mail title="Reprogramación de Evaluación" :recipientEmail="$recipientEmail">
<p>Hola {{ $recipientName }},</p>
<p>Tu docente ha programado la reposición de la evaluación para la siguiente fecha:</p>
<ul>
    <li><strong>Fecha:</strong> {{ $fecha }}</li>
    <li><strong>Hora:</strong> {{ $hora }}</li>
    <li><strong>Observaciones/Lugar:</strong> {{ $observaciones }}</li>
</ul>
<p>Por favor confirma tu asistencia respondiendo a este correo.</p>
</x-uam-mail>