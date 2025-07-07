@component('mail::message')
# ¡Bienvenido a JustiFIA - UAM!

Hola {{ $user->name }},

Gracias por registrarte en JustiFIA - UAM. Antes de comenzar, necesitamos verificar que esta dirección de correo te pertenece.

@component('mail::button', ['url' => $url])
Verificar mi correo
@endcomponent

Si el botón no funciona, copia y pega este enlace en tu navegador:  
[{{ $url }}]({{ $url }})

---

**¿Tienes problemas?**  
Responde a este correo o contáctanos en [soporte@uam.edu.ni](mailto:soporte@uam.edu.ni)

Gracias,  
El equipo de JustiFIA - UAM

@slot('footer')
© {{ date('Y') }} JustiFIA - UAM. Todos los derechos reservados.
@endcomponent
