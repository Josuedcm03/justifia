<x-guest-layout>
    <div class="text-center py-10 space-y-4">
        <h1 class="text-2xl font-bold text-[#0b545b]">Bienvenido a Justifia</h1>
        <p class="text-gray-600 dark:text-gray-400">Inicia sesión o regístrate para continuar.</p>
        <div class="flex justify-center gap-4">
            <a href="{{ route('login') }}" class="px-4 py-2 bg-[#0095a4] text-white rounded-md">Iniciar sesión</a>
            <a href="{{ route('register') }}" class="px-4 py-2 bg-[#31c0d3] text-white rounded-md">Registrarse</a>
        </div>
    </div>
</x-guest-layout>