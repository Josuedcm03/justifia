<?php

namespace App\Presentation\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * Define the routes for the presentation layer.
     */
    public function boot(): void
    {
        $this->routes(function () {
            Route::middleware('web')
                ->group(base_path('routes/presentation/web.php'));

            Route::middleware('web')
                ->group(base_path('routes/presentation/auth.php'));
        });
    }
}
