<x-uam-mail title="Restablecer contraseña" :recipientEmail="$recipientEmail">
<p>Hola {{ $recipientName }},</p>
<p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Para continuar, haz clic en el siguiente enlace:</p>
<p style="text-align:center;"><a href="{{ $url }}" style="background:#0099a8;color:#ffffff;padding:10px 15px;border-radius:5px;display:inline-block;text-decoration:none;">Restablecer contraseña</a></p>
<p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
<p><a href="{{ $url }}">{{ $url }}</a></p>
<p>Si no solicitaste restablecer tu contraseña, puedes ignorar este mensaje.</p>
</x-uam-mail>