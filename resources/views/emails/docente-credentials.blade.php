<x-uam-mail title="Credenciales de Acceso" :recipientEmail="$recipientEmail">
<p>Hola {{ $recipientName }},</p>
<p>Se ha creado una cuenta para usted en el sistema de Justificaciones por inasistencias. Estas son sus credenciales de acceso:</p>
<ul>
    <li><strong>Correo:</strong> {{ $recipientEmail }}</li>
    <li><strong>Contraseña:</strong> {{ $password }}</li>
</ul>
<p>Al iniciar sesión en el sistema deberá autenticarse con este mismo correo para mantener la seguridad de su cuenta.</p>
<p>Por seguridad, cambie su contraseña después del primer ingreso.</p>
</x-uam-mail>