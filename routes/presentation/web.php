<?php

use App\Presentation\Http\Controllers\Docentes\ReprogramacionController as DocenteReprogramacionController;
use App\Presentation\Http\Controllers\Estudiante\ApelacionController as EstudianteApelacionController;
use App\Presentation\Http\Controllers\Estudiante\SolicitudController as EstudianteSolicitudController;
use App\Presentation\Http\Controllers\Perfil\ProfileController;
use App\Presentation\Http\Controllers\Secretaria\ApelacionController as SecretariaApelacionController;
use App\Presentation\Http\Controllers\Secretaria\AsignaturaController;
use App\Presentation\Http\Controllers\Secretaria\CatalogoController;
use App\Presentation\Http\Controllers\Secretaria\CarreraController;
use App\Presentation\Http\Controllers\Secretaria\DocenteController;
use App\Presentation\Http\Controllers\Secretaria\FacultadController;
use App\Presentation\Http\Controllers\Secretaria\SolicitudController as SecretariaSolicitudController;
use App\Presentation\Http\Controllers\Secretaria\TipoConstanciaController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

// During testing we skip the authentication screens and go straight to the
// dashboard. The root URL and `/dashboard` both render the dashboard view
// without requiring authentication.
Route::get('/', function () {
    return Auth::check() ? view('presentation.dashboard') : view('presentation.home');
})->name('home');

Route::get('/dashboard', function () {
    return view('presentation.dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

// Profile management still requires authentication once that feature is ready.
Route::middleware(['auth', 'throttle:global'])->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
});

Route::middleware(['auth', 'verified', 'role:estudiante', 'throttle:global'])
    ->prefix('estudiante')
    ->name('estudiante.')
    ->group(function () {
        Route::get('docentes/buscar', [EstudianteSolicitudController::class, 'buscarDocentes'])
            ->name('docentes.buscar');
        Route::get('asignaturas/buscar', [EstudianteSolicitudController::class, 'buscarAsignaturas'])
            ->name('asignaturas.buscar');
        Route::get('facultades/{facultad}/asignaturas', [EstudianteSolicitudController::class, 'asignaturasPorFacultad'])
            ->name('facultades.asignaturas');
        Route::resource('solicitudes', EstudianteSolicitudController::class)->parameters([
            'solicitudes' => 'solicitud',
        ]);
        Route::resource('solicitudes.apelaciones', EstudianteApelacionController::class)
            ->parameters([
                'solicitudes' => 'solicitud',
                'apelaciones' => 'apelacion',
            ]);

        Route::resource('apelaciones', EstudianteApelacionController::class)
            ->only(['index', 'show'])
            ->parameters([
                'apelaciones' => 'apelacion',
            ]);
    });

Route::middleware(['auth', 'verified', 'role:secretaria'])
    ->prefix('secretaria')
    ->name('secretaria.')
    ->group(function () {
        Route::resource('solicitudes', SecretariaSolicitudController::class)
            ->only(['index', 'show', 'update'])
            ->parameters([
                'solicitudes' => 'solicitud',
            ]);

        Route::resource('apelaciones', SecretariaApelacionController::class)
            ->only(['index', 'show', 'update'])
            ->parameters([
                'apelaciones' => 'apelacion',
            ]);

        Route::resource('asignaturas', AsignaturaController::class);
        Route::get('asignaturas-importar', [AsignaturaController::class, 'showImport'])->name('asignaturas.import.form');
        Route::post('asignaturas-importar', [AsignaturaController::class, 'import'])->name('asignaturas.import');

        Route::resource('facultades', FacultadController::class)->parameters([
            'facultades' => 'facultad',
        ]);
        Route::resource('carreras', CarreraController::class);

        Route::resource('docentes', DocenteController::class);
        Route::get('docentes-importar', [DocenteController::class, 'showImport'])->name('docentes.import.form');
        Route::post('docentes-importar', [DocenteController::class, 'import'])->name('docentes.import');

        Route::resource('tipo-constancia', TipoConstanciaController::class)->parameters([
            'tipo-constancia' => 'tipo_constancia',
        ]);

        Route::get('catalogos', [CatalogoController::class, 'index'])->name('catalogos.index');
    });

Route::middleware(['auth', 'role:docente', 'throttle:global'])
    ->prefix('docente')
    ->name('docente.')
    ->group(function () {
        Route::get('solicitudes', [DocenteReprogramacionController::class, 'index'])->name('solicitudes.index');
        Route::get('solicitudes/{solicitud}', [DocenteReprogramacionController::class, 'show'])->name('solicitudes.show');
        Route::post('solicitudes/{solicitud}/reprogramacion', [DocenteReprogramacionController::class, 'storeReprogramacion'])
            ->name('solicitudes.reprogramacion.store');
        Route::patch('solicitudes/{solicitud}/reprogramacion', [DocenteReprogramacionController::class, 'updateReprogramacion'])
            ->name('solicitudes.reprogramacion.update');
    });
