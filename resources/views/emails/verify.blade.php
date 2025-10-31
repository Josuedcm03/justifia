<x-uam-mail title="Verifica tu correo" :recipientEmail="$recipientEmail">
<p>Hola {{ $recipientName }},</p>
<p>Gracias por registrarte en el Sistema de Justificaciones. Para continuar, verifica que esta dirección de correo te pertenece haciendo clic en el siguiente enlace:</p>
<p style="text-align:center;"><a href="{{ $url }}" style="background:#0099a8;color:#ffffff;padding:10px 15px;border-radius:5px;display:inline-block;text-decoration:none;">Verificar mi correo</a></p>
<p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
<p><a href="{{ $url }}">{{ $url }}</a></p>
<p>Gracias,<br> Justificaciones - UAM. Todos los derechos reservados.</p>
</x-uam-mail>