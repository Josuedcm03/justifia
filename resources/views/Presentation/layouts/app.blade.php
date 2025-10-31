<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <script>
        // Tema: no usa Blade dentro del script
        if (localStorage.getItem('theme') === 'dark') {
            document.documentElement.classList.add('dark');
        }
    </script>+ 

    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>{{ config('app.name', 'Laravel') }}</title>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

    <!-- Scripts -->
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" defer></script>
</head>

<body class="font-sans antialiased">

    <div class="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-150">
        @include('layouts.navigation')
        <x-loader />

        <!-- Page Heading -->
        @isset($header)
        <header class="bg-[#0099a8] shadow">
            <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                {{ $header }}
            </div>
        </header>
        @endisset

        <!-- Page Content -->
        <main>
            {{ $slot }}
        </main>
    </div>

    <!-- ===== Flash payload (sin Blade dentro del script) ===== -->
    <div id="flash-payload"
        data-success="{{ session('success') ? e(session('success')) : '' }}"
        data-error="{{ session('error') ? e(session('error')) : '' }}"
        data-has-errors="{{ $errors->any() ? '1' : '0' }}"
        hidden></div>

    <!-- ===== Script único que lee los data-attributes ===== -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const el = document.getElementById('flash-payload');
            if (!el) return;

            const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
            const successMsg = el.dataset.success || '';
            const errorMsg = el.dataset.error || '';
            const hasErrors = el.dataset.hasErrors === '1';

            // Success
            if (successMsg) {
                Swal.fire({
                    theme,
                    title: 'Éxito',
                    text: successMsg,
                    icon: 'success',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#0b545b'
                });
                return;
            }

            // Error directo
            if (errorMsg) {
                Swal.fire({
                    theme,
                    title: 'Error',
                    text: errorMsg,
                    icon: 'error',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#0b545b'
                });
                return;
            }

            // Errores de validación
            if (hasErrors) {
                Swal.fire({
                    theme,
                    title: 'Error',
                    text: 'Hubo errores al procesar la solicitud.',
                    icon: 'error',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#0b545b'
                });
            }
        });
    </script>

</body>

</html>