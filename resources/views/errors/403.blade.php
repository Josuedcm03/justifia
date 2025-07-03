<x-guest-layout>
    <div class="text-center space-y-6">
        <x-heroicon-o-lock-closed class="mx-auto w-16 h-16 text-[#0099a8] dark:text-[#40c4d0]" />

        <h1 class="text-3xl font-bold text-gray-800 dark:text-white">403 - Acceso denegado</h1>

        <p class="text-gray-700 dark:text-gray-300">
            No tienes permiso para acceder a esta página
        </p>

        <a href="{{ route('home') }}"
            class="inline-block px-6 py-3 bg-[#0099a8] hover:bg-[#007e8b] text-white font-semibold rounded-lg shadow transition duration-200">
            Ir al inicio
        </a>
    </div>
</x-guest-layout>
