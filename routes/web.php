<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EstudianteSolicitudController;
use App\Http\Controllers\EstudianteApelacionController;
use App\Http\Controllers\SecretariaSolicitudController;

// During testing we skip the authentication screens and go straight to the
// dashboard. The root URL and `/dashboard` both render the dashboard view
// without requiring authentication.

Route::get('/', function () {
    //return view('welcome');
    return view('dashboard');
});

Route::get('/dashboard', function () {
    return view('dashboard');
//})->middleware(['auth', 'verified'])->name('dashboard');
})->name('dashboard');

// Profile management still requires authentication once that feature is ready.

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';

Route::prefix('estudiante')->name('estudiante.')->group(function () {
    Route::get('docentes/{docente}/asignaturas', [EstudianteSolicitudController::class, 'asignaturasPorDocente'])
        ->name('docentes.asignaturas');
    Route::resource('solicitudes', EstudianteSolicitudController::class)->parameters([
        'solicitudes' => 'solicitud'
    ]);
    Route::resource('apelaciones', EstudianteApelacionController::class)->parameters([
        'apelaciones' => 'apelacion'
    ]);
});

Route::prefix('secretaria')->name('secretaria.')->group(function () {
    Route::resource('solicitudes', SecretariaSolicitudController::class)
        ->only(['index', 'show', 'update'])
        ->parameters([
            'solicitudes' => 'solicitud'
        ]);
});