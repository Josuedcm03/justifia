<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    @php
        $isAuthPage = request()->routeIs('login') || request()->routeIs('register');
        $isAuthPage = $isAuthPage || request()->routeIs('password.*') || request()->routeIs('verification.*') || request()->routeIs('home');
    @endphp
    
    <script>
        @if(! $isAuthPage)
            if (localStorage.getItem('theme') === 'dark') {
                document.documentElement.classList.add('dark');
            }
        @else
            localStorage.setItem('theme', 'light');
            document.documentElement.classList.remove('dark');
        @endif
    </script>

    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>{{ config('app.name', 'Laravel') }}</title>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

    <!-- Scripts -->
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="font-sans text-gray-900 antialiased">
    <x-loader />
    <div class="{{ $isAuthPage ? 'relative min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-cover bg-center' : 'min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-gray-100 dark:bg-gray-900' }}"
        @if($isAuthPage) style="background-image: url(/images/fondoUAM.jpeg);" @endif>
        @if ($isAuthPage)
            <div class="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
        @endif


        <div class="relative z-10 w-full sm:max-w-md mt-6 px-6 py-4 bg-white/70 dark:bg-gray-800 shadow-md overflow-hidden sm:rounded-lg">
            {{ $slot }}
        </div>
    </div>

</body>
</html>
