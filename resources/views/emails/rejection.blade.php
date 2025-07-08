<x-uam-mail title="Solicitud Rechazada" :recipientEmail="$recipientEmail">
<p>Hola {{ $recipientName }},</p>
<p>Lamentamos informarte que tu solicitud de justificación de inasistencia ha sido <strong>rechazada</strong>.</p>
@if(!empty($observaciones))
<p><strong>Observaciones:</strong> {{ $observaciones }}</p>
@endif
<p>Si no estás conforme con el rechazo de esta solicitud, puedes realizar una apelación.</p>
</x-uam-mail>