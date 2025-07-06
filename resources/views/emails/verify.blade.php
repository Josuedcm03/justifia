@component('mail::message')
# Verifica tu correo

Gracias por registrarte. Para continuar debes confirmar tu direccion de correo.

@component('mail::button', ['url' => $url])
Verificar correo
@endcomponent

Si no creaste una cuenta, puedes ignorar este mensaje.

@endcomponent