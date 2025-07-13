<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class CustomResetPassword extends ResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        $url = $this->resetUrl($notifiable);

        return (new MailMessage)
            ->subject('Restablecer contraseña')
            ->markdown('emails.reset-password', [
                'url' => $url,
                'recipientName' => $notifiable->name,
                'recipientEmail' => $notifiable->email,
            ]);
    }
}