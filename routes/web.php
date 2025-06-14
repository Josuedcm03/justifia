<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SolicitudController;

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

Route::get('docentes/{docente}/asignaturas', [SolicitudController::class, 'asignaturasPorDocente'])
    ->name('docentes.asignaturas');
Route::resource('solicitudes', SolicitudController::class)->parameters([
    'solicitudes' => 'solicitud'
]);
