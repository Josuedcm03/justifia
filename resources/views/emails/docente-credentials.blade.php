<x-uam-mail title="Credenciales de Acceso" :recipientEmail="$recipientEmail">
<p>Hola {{ $recipientName }},</p>
<p>Se ha creado una cuenta para usted en el sistema de Justificaciones de Inasistencias.</p>
<p>Antes de poder acceder al sistema, debe establecer su contraseña. Haga clic en el siguiente enlace:</p>
<p style="text-align:center;"><a href="{{ $url }}" style="background:#0099a8;color:#ffffff;padding:10px 15px;border-radius:5px;display:inline-block;text-decoration:none;">Establecer contraseña</a></p>
<p>Si el botón no funciona, copie y pegue este enlace en su navegador:</p>
<p><a href="{{ $url }}">{{ $url }}</a></p>
</x-uam-mail>