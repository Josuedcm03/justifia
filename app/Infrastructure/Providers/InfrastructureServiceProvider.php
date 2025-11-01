<?php

namespace App\Infrastructure\Providers;

use App\Application\Shared\Contracts\FileStorage;
use App\Application\Shared\Contracts\Mailer;
use App\Application\Shared\Contracts\TransactionManager;
use App\Application\Shared\Event\EventBus;
use App\Application\Reprogramaciones\Events\ReprogramacionCreada;
use App\Application\Reprogramaciones\Observers\ReprogramacionCreadaMailerObserver;
use App\Application\Solicitudes\Events\SolicitudEstadoActualizado;
use App\Application\Solicitudes\Observers\SolicitudEstadoActualizadoMailerObserver;
use App\Domain\Apelaciones\Repositories\ApelacionRepository;
use App\Domain\Catalogo\Repositories\AsignaturaRepository;
use App\Domain\Catalogo\Repositories\CarreraRepository;
use App\Domain\Catalogo\Repositories\FacultadRepository;
use App\Domain\Catalogo\Repositories\TipoConstanciaRepository;
use App\Domain\Docente\Repositories\DocenteRepository;
use App\Domain\Reprogramacion\Repositories\ReprogramacionRepository;
use App\Domain\Solicitud\Repositories\SolicitudRepository;
use App\Infraestructure\Files\PublicDiskFileStorage;
use App\Infrastructure\Mail\LaravelMailer;
use App\Infrastructure\Event\InMemoryEventBus;
use App\Infrastructure\Persistence\DatabaseTransactionManager;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentApelacionRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentAsignaturaRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentCarreraRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentDocenteRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentFacultadRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentReprogramacionRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentSolicitudRepository;
use App\Infraestructure\Persistence\Eloquent\Repositories\EloquentTipoConstanciaRepository;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;

class InfrastructureServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SolicitudRepository::class, EloquentSolicitudRepository::class);
        $this->app->bind(DocenteRepository::class, EloquentDocenteRepository::class);
        $this->app->bind(FacultadRepository::class, EloquentFacultadRepository::class);
        $this->app->bind(CarreraRepository::class, EloquentCarreraRepository::class);
        $this->app->bind(TipoConstanciaRepository::class, EloquentTipoConstanciaRepository::class);
        $this->app->bind(AsignaturaRepository::class, EloquentAsignaturaRepository::class);
        $this->app->bind(ApelacionRepository::class, EloquentApelacionRepository::class);
        $this->app->bind(ReprogramacionRepository::class, EloquentReprogramacionRepository::class);

        $this->app->bind(FileStorage::class, PublicDiskFileStorage::class);
        $this->app->when(PublicDiskFileStorage::class)
            ->needs(FilesystemAdapter::class)
            ->give(fn (): FilesystemAdapter => Storage::disk('public'));

        $this->app->bind(Mailer::class, LaravelMailer::class);
        $this->app->bind(TransactionManager::class, DatabaseTransactionManager::class);
        $this->app->singleton(EventBus::class, InMemoryEventBus::class);
    }

    public function boot(): void
    {
        $bus = $this->app->make(EventBus::class);

        $bus->subscribe(
            SolicitudEstadoActualizado::class,
            $this->app->make(SolicitudEstadoActualizadoMailerObserver::class)
        );

        $bus->subscribe(
            ReprogramacionCreada::class,
            $this->app->make(ReprogramacionCreadaMailerObserver::class)
        );
    }
}
