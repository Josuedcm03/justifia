<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\ModuloEstudiante\SolicitudController as EstudianteSolicitudController;
use App\Http\Controllers\ModuloEstudiante\ApelacionController as EstudianteApelacionController;
use App\Http\Controllers\ModuloSecretaria\SolicitudController as SecretariaSolicitudController;
use App\Http\Controllers\ModuloSecretaria\ApelacionController as SecretariaApelacionController;
use App\Http\Controllers\ModuloDocente\ReprogramacionController as DocenteReprogramacionController;

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
    Route::resource('solicitudes.apelaciones', EstudianteApelacionController::class)
        ->parameters([
            'solicitudes' => 'solicitud',
            'apelaciones' => 'apelacion'
        ]);

    Route::resource('apelaciones', EstudianteApelacionController::class)
        ->only(['index', 'show'])
        ->parameters([
            'apelaciones' => 'apelacion'
        ]);
});

Route::prefix('secretaria')->name('secretaria.')->group(function () {
    Route::resource('solicitudes', SecretariaSolicitudController::class)
        ->only(['index', 'show', 'update'])
        ->parameters([
            'solicitudes' => 'solicitud'
        ]);

        Route::resource('apelaciones', SecretariaApelacionController::class)
        ->only(['index', 'show', 'update'])
        ->parameters([
            'apelaciones' => 'apelacion'
        ]);

        });

Route::prefix('docente')->name('docente.')->group(function () {
    Route::get('solicitudes', [DocenteReprogramacionController::class, 'index'])->name('solicitudes.index');
    Route::get('solicitudes/{solicitud}', [DocenteReprogramacionController::class, 'show'])->name('solicitudes.show');
    Route::post('solicitudes/{solicitud}/reprogramacion', [DocenteReprogramacionController::class, 'storeReprogramacion'])->name('solicitudes.reprogramacion.store');
    Route::patch('solicitudes/{solicitud}/reprogramacion', [DocenteReprogramacionController::class, 'updateReprogramacion'])->name('solicitudes.reprogramacion.update');
});