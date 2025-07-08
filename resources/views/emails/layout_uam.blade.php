<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $title ?? 'Notificación UAM' }}</title>
    <style>
        body { margin:0; padding:0; background:#f5f5f5; font-family:Arial, sans-serif; }
        .container { max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; }
        .header { background:#0b545b; color:#ffffff; text-align:center; padding:20px; }
        .header img { max-width:150px; margin-bottom:10px; }
        .content { padding:20px; font-size:16px; line-height:1.5; color:#333333; }
        .footer { background:#f0f0f0; color:#555555; text-align:center; padding:20px; font-size:12px; }
        .footer a { color:#0b545b; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="{{ asset('images/logo.png') }}" alt="UAM">
            <h1 style="margin:0;font-size:22px;">Sistema de Justificación de Inasistencias</h1>
        </div>
        <div class="content">
            {{ $slot }}
        </div>
        <div class="footer">
            <p><strong>Coordinación de Educación Virtual - Universidad Americana</strong><br>
            Dirección: Costado Noroeste Camino de Oriente. Managua, Nicaragua<br>
            PBX: +(505) 2278-3800 Ext. 5484</p>
            <p>Este email fue enviado por info@uam.edu.ni a {{ $recipientEmail ?? '' }}.</p>
            <p><a href="#">Cancelar suscripción</a> | <a href="#">Administrar preferencias</a> | <a href="#">Te Interesa Suscríbete</a></p>
            <p style="color:#888888;">Aviso de confidencialidad: Este mensaje es para uso exclusivo del destinatario.</p>
        </div>
    </div>
</body>
</html>