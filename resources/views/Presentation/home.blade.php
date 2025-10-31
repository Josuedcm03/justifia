<x-guest-layout>
    <div class="text-center py-12 px-6 space-y-6">
        <!-- Logo centrado -->
        <div class="flex justify-center mb-4">
            <a href="/">
                <x-application-logoalt class="w-16 h-16" />
            </a>
        </div>

        <!-- Título principal -->
        <h1 class="text-2xl font-extrabold text-gray-700">
            Bienvenido<a class="text-xl font-medium">(a)</a> al Portal de Justificación de Inasistencias
        </h1>

        <!-- Descripción profesional -->
        <p class="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto ">
            Este portal está diseñado para facilitar la justificación de inasistencias de manera eficiente, transparente y segura
        </p>

        
        <!-- Descripción profesional -->
        <p class="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto ">
            Para continuar inicia sesión o regístrate:
        </p>


        

        <!-- Botones -->
        <div class="flex justify-center gap-6 mt-6 flex-wrap">
            <a href="{{ route('login') }}"
                class="px-8 py-2.5 bg-[#0099a8] hover:bg-[#007e8b] text-white font-medium rounded-lg shadow-md transition-transform transform hover:scale-105 hover:shadow-lg duration-300">
                Iniciar sesión
            </a>

            <a href="{{ route('register') }}"
                class="px-8 py-2.5 bg-[#0099a8] hover:bg-[#007e8b] text-white font-medium rounded-lg shadow-md transition-transform transform hover:scale-105 hover:shadow-lg duration-300">
                Registrarse
            </a>
        </div>
    </div>
</x-guest-layout>
