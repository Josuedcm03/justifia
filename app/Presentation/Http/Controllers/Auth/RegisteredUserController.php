<?php

namespace App\Presentation\Http\Controllers\Auth;

use App\Domain\Estudiante\Entities\Estudiante;
use App\Domain\Seguridad\Entities\Role;
use App\Domain\Shared\ValueObjects\EmailInstitucional;
use App\Domain\Usuarios\Entities\User;
use App\Presentation\Http\Controllers\Controller;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Support\Facades\Validator;
use Illuminate\View\View;
use App\Domain\Catalogo\Entities\Carrera;

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
        $validator = Validator::make(
            $request->all(),
            [
                'name' => ['required', 'string', 'max:255'],
                'email' => [
                    'required',
                    'string',
                    'lowercase',
                    'email',
                    'max:255',
                    'unique:' . User::class,
                    'regex:/^[^@\s]+@uamv\.edu\.ni$/i',
                ],
                'cif' => ['required', 'numeric', 'digits:8', 'unique:estudiantes,cif'],
                'carrera_id' => ['required', 'exists:carreras,id'],
                'password' => ['required', 'confirmed', Rules\Password::defaults()],
            ],
            [
                'email.regex' => 'El correo no es institucional.',
            ]
        );

        if ($validator->fails()) {
            return back()
                ->withErrors($validator)
                ->withInput($request->except($validator->errors()->keys()));
        }
        
        $estudianteRole = Role::where('name', 'estudiante')->first();
        $correoInstitucional = (string) new EmailInstitucional($request->email);

        $user = User::create([
            'name' => $request->name,
            'email' => $correoInstitucional,
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
