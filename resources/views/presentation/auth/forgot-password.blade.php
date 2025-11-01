<x-guest-layout>
    <a href="{{ route('login') }}" class="flex items-center mb-4 text-gray-600 hover:text-[#006b75] transition">
        <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
        {{ __('Volver') }}
    </a>

    <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-gray-700">{{ __('¿Olvidaste tu contraseña?') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ __('Ingresa tu correo institucional y te enviaremos un enlace para restablecerla') }}</p>
    </div>

    <!-- Session Status -->
    <x-auth-session-status class="mb-4" :status="session('status')" />

    <form method="POST" action="{{ route('password.email') }}">
        @csrf

        <!-- Email Address -->
        <div class="mb-4">
            <x-input-label for="email" :value="__('Correo institucional')" />
            <div class="relative">
                <x-heroicon-o-envelope class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#31c0d3]" />
                <input id="email" class="block mt-1 w-full ps-10 rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-[#31c0d3] focus:ring-[#31c0d3] shadow-sm" type="email" name="email" :value="old('email')" required autofocus />
            </div>
            <x-input-error :messages="$errors->get('email')" class="mt-2" />
        </div>

        <div class="flex items-center justify-end mt-4">
            <x-primary-button>
                {{ __('Enviar enlace de restablecimiento') }}
            </x-primary-button>
        </div>
    </form>
</x-guest-layout>