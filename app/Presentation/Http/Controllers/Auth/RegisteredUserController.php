<?php

namespace App\Presentation\Http\Controllers\Auth;

use App\Application\Seguridad\Commands\RegistrarEstudianteCommand;
use App\Application\Seguridad\Handlers\RegistrarEstudianteHandler;
use App\Presentation\Http\Controllers\Shared\Controller;
use App\Presentation\Http\Requests\Auth\RegisterUserRequest;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;
use App\Domain\Catalogo\Entities\Carrera;

class RegisteredUserController extends Controller
{
    public function __construct(private readonly RegistrarEstudianteHandler $registrarEstudiante)
    {
    }

    /**
     * Display the registration view.
     */
    public function create(): View
    {
        $carreras = Carrera::all();
        return view('presentation.auth.register', compact('carreras'));
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(RegisterUserRequest $request): RedirectResponse
    {
        $user = $this->registrarEstudiante->handle(
            new RegistrarEstudianteCommand($request->toDto())
        );

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }
}
