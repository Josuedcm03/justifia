<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\View\View;
use App\Models\ModuloSeguridad\Role;
use App\Models\ModuloSecretaria\Carrera;
use App\Models\ModuloEstudiante\Estudiante;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): View
    {
        $carreras = Carrera::all();
        return view('auth.register', compact('carreras'));
        //return view('auth.register');
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'cif' => ['required', 'string', 'max:255', 'unique:estudiantes,cif'],
            'carrera_id' => ['required', 'exists:carreras,id'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $estudianteRole = Role::where('name', 'estudiante')->first();

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role_id' => $estudianteRole?->id,
        ]);

        Estudiante::create([
            'cif' => $request->cif,
            'usuario_id' => $user->id,
            'carrera_id' => $request->carrera_id,
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }
}
