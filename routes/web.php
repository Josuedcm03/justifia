<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\ModuloEstudiante\SolicitudController as EstudianteSolicitudController;
use App\Http\Controllers\ModuloEstudiante\ApelacionController as EstudianteApelacionController;
use App\Http\Controllers\ModuloSecretaria\SolicitudController as SecretariaSolicitudController;
use App\Http\Controllers\ModuloSecretaria\ApelacionController as SecretariaApelacionController;
use App\Http\Controllers\ModuloSecretaria\AsignaturaController;
use App\Http\Controllers\ModuloSecretaria\CarreraController;
use App\Http\Controllers\ModuloSecretaria\FacultadController;
use App\Http\Controllers\ModuloSecretaria\DocenteController;
use App\Http\Controllers\ModuloSecretaria\TipoConstanciaController;
use App\Http\Controllers\ModuloSecretaria\CatalogoController;
use App\Http\Controllers\ModuloDocente\ReprogramacionController as DocenteReprogramacionController;
use Illuminate\Support\Facades\Auth;

// During testing we skip the authentication screens and go straight to the
// dashboard. The root URL and `/dashboard` both render the dashboard view
// without requiring authentication.

Route::get('/', function () {
    return Auth::check() ? view('dashboard') : view('home');
})->name('home');

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

// Profile management still requires authentication once that feature is ready.

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
});

require __DIR__.'/auth.php';

Route::middleware(['auth', 'verified', 'role:estudiante'])->prefix('estudiante')->name('estudiante.')->group(function () {
    Route::get('docentes/buscar', [EstudianteSolicitudController::class, 'buscarDocentes'])
        ->name('docentes.buscar');
    Route::get('facultades/{facultad}/asignaturas', [EstudianteSolicitudController::class, 'asignaturasPorFacultad'])
        ->name('facultades.asignaturas');
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

Route::middleware(['auth', 'verified', 'role:secretaria'])->prefix('secretaria')->name('secretaria.')->group(function () {
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

        Route::resource('asignaturas', AsignaturaController::class);
        Route::get('asignaturas-importar', [AsignaturaController::class, 'showImport'])->name('asignaturas.import.form');
        Route::post('asignaturas-importar', [AsignaturaController::class, 'import'])->name('asignaturas.import');

        Route::resource('facultades', FacultadController::class)->parameters([
            'facultades' => 'facultad'
        ]);
        Route::resource('carreras', CarreraController::class);

        Route::resource('docentes', DocenteController::class);
        Route::get('docentes-importar', [DocenteController::class, 'showImport'])->name('docentes.import.form');
        Route::post('docentes-importar', [DocenteController::class, 'import'])->name('docentes.import');

        Route::resource('tipo-constancia', TipoConstanciaController::class)->parameters([
    'tipo-constancia' => 'tipo_constancia'
]);

Route::get('catalogos', [CatalogoController::class, 'index'])->name('catalogos.index');
    });

Route::middleware(['auth', 'verified', 'role:docente'])->prefix('docente')->name('docente.')->group(function () {
    Route::get('solicitudes', [DocenteReprogramacionController::class, 'index'])->name('solicitudes.index');
    Route::get('solicitudes/{solicitud}', [DocenteReprogramacionController::class, 'show'])->name('solicitudes.show');
    Route::post('solicitudes/{solicitud}/reprogramacion', [DocenteReprogramacionController::class, 'storeReprogramacion'])->name('solicitudes.reprogramacion.store');
    Route::patch('solicitudes/{solicitud}/reprogramacion', [DocenteReprogramacionController::class, 'updateReprogramacion'])->name('solicitudes.reprogramacion.update');
});