<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): View
    {
        return view('auth.login');
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        $user = $request->user();

        if ($user?->hasRole('docente') && ! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }

        $redirect = route('dashboard', absolute: false);

        if ($user?->hasRole('estudiante')) {
            $redirect = route('estudiante.solicitudes.index', absolute: false);
        } elseif ($user?->hasRole('secretaria')) {
            $redirect = route('secretaria.solicitudes.index', absolute: false);
        } elseif ($user?->hasRole('docente')) {
            $redirect = route('docente.solicitudes.index', absolute: false);
        }

        return redirect()->intended($redirect);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
