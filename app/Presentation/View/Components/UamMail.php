<?php

namespace App\Presentation\View\Components;

use Illuminate\View\Component;
use Illuminate\View\View;

class UamMail extends Component
{
    public string $title;
    public ?string $recipientEmail;

    public function __construct(string $title = 'Notificación UAM', ?string $recipientEmail = null)
    {
        $this->title = $title;
        $this->recipientEmail = $recipientEmail;
    }

    public function render(): View
    {
        return view('emails.layout_uam');
    }
}