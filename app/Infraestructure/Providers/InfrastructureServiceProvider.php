<?php

namespace App\Infraestructure\Providers;

use App\Application\Solicitudes\Handlers\SolicitudService;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;
use App\Domain\Catalogo\Repositories\FacultadRepository;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;
use App\Domain\Docente\Repositories\DocenteRepository;
use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentApelacionRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentAsignaturaRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentDocenteRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentFacultadRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentReprogramacionRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentSolicitudRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentTipoConstanciaRepository;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;

class InfrastructureServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SolicitudRepository::class, EloquentSolicitudRepository::class);
        $this->app->bind(DocenteRepository::class, EloquentDocenteRepository::class);
        $this->app->bind(FacultadRepository::class, EloquentFacultadRepository::class);
        $this->app->bind(TipoConstanciaRepository::class, EloquentTipoConstanciaRepository::class);
        $this->app->bind(AsignaturaRepository::class, EloquentAsignaturaRepository::class);
        $this->app->bind(ApelacionRepository::class, EloquentApelacionRepository::class);
        $this->app->bind(ReprogramacionRepository::class, EloquentReprogramacionRepository::class);

        $this->app
            ->when(SolicitudService::class)
            ->needs(Filesystem::class)
            ->give(fn() => Storage::disk('public'));
    }

    public function boot(): void
    {
    }
}