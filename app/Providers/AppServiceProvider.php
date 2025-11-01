<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('global', function (Request $request) {
            return Limit::perMinute(120)->by(
                $request->user()?->id ?: $request->ip()
            );
        });

        Blade::component('app-layout', \App\Presentation\View\Components\AppLayout::class);
        Blade::component('guest-layout', \App\Presentation\View\Components\GuestLayout::class);
        Blade::component('uam-mail', \App\Presentation\View\Components\UamMail::class);
    }
}
