<x-guest-layout>
    <a href="{{ route('home') }}" class="flex items-center mb-4 text-gray-600 hover:text-[#006b75] transition">
        <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
        {{ __('Volver') }}
    </a>

    <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-[#006b75]">{{ __('Registrarse como estudiante') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ __('Por favor, complete el formulario para crear una cuenta') }}</p>
    </div>

    <form method="POST" action="{{ route('register') }}" x-data="{ pass: false, confirm: false }">
        @csrf

        <!-- Name -->
        <div class="mb-4">
            <x-input-label for="name" :value="__('Nombre completo')" />
            <div class="relative">
                <x-heroicon-o-user class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#31c0d3]" />
                <input id="name" class="block mt-1 w-full ps-10 rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-[#31c0d3] focus:ring-[#31c0d3] shadow-sm" type="text" name="name" value="{{ old('name') }}" required autofocus autocomplete="name" />
            </div>
            <x-input-error :messages="$errors->get('name')" class="mt-2" />
        </div>

        <!-- CIF -->
        <div class="mb-4">
            <x-input-label for="cif" :value="__('CIF')" />
            <div class="relative">
                <x-heroicon-o-identification class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#31c0d3]" />
                <input id="cif" class="block mt-1 w-full ps-10 rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-[#31c0d3] focus:ring-[#31c0d3] shadow-sm" type="text" name="cif" value="{{ old('cif') }}" required />
            </div>
            <x-input-error :messages="$errors->get('cif')" class="mt-2" />
        </div>

        <!-- Career -->
        <div class="mb-4">
            <x-input-label for="carrera_id" :value="__('Carrera principal')" />
            <select id="carrera_id" name="carrera_id" class="block mt-1 w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-[#31c0d3] focus:ring-[#31c0d3] shadow-sm">
                <option value="">Seleccione su carrera</option>
                @foreach($carreras as $carrera)
                    <option value="{{ $carrera->id }}" @selected(old('carrera_id') == $carrera->id)>{{ $carrera->nombre }}</option>
                @endforeach
            </select>
            <x-input-error :messages="$errors->get('carrera_id')" class="mt-2" />
        </div>

        <!-- Email Address -->
        <div class="mb-4">
            <x-input-label for="email" :value="__('Correo institucional')" />
            <div class="relative">
                <x-heroicon-o-envelope class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#31c0d3]" />
                <input id="email" class="block mt-1 w-full ps-10 rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-[#31c0d3] focus:ring-[#31c0d3] shadow-sm" type="email" name="email" value="{{ old('email') }}" required autocomplete="username" />
            </div>
            <x-input-error :messages="$errors->get('email')" class="mt-2" />
        </div>

        <!-- Password -->
        <div class="mb-4" x-data="{ visible: pass }">
            <x-input-label for="password" :value="__('Contraseña')" />
            <div class="relative">
                <x-heroicon-o-lock-closed x-show="!visible" class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#31c0d3]" />
                <x-heroicon-o-lock-open x-show="visible" x-cloak class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#31c0d3]" />
                <input :type="visible ? 'text' : 'password'" id="password" class="block mt-1 w-full ps-10 pe-10 rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-[#31c0d3] focus:ring-[#31c0d3] shadow-sm" name="password" required autocomplete="new-password" />
                <button type="button" @click="pass = !pass; visible = pass" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">
                    <x-heroicon-o-eye x-show="!visible" class="w-5 h-5" />
                    <x-heroicon-o-eye-slash x-show="visible" x-cloak class="w-5 h-5" />
                </button>
            </div>
            <x-input-error :messages="$errors->get('password')" class="mt-2" />
        </div>

        <!-- Confirm Password -->
        <div class="mb-4" x-data="{ visible: confirm }">
            <x-input-label for="password_confirmation" :value="__('Confirmar Contraseña')" />
            <div class="relative">
                <x-heroicon-o-lock-closed x-show="!visible" class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#31c0d3]" />
                <x-heroicon-o-lock-open x-show="visible" x-cloak class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#31c0d3]" />
                <input :type="visible ? 'text' : 'password'" id="password_confirmation" class="block mt-1 w-full ps-10 pe-10 rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-[#31c0d3] focus:ring-[#31c0d3] shadow-sm" name="password_confirmation" required autocomplete="new-password" />
                <button type="button" @click="confirm = !confirm; visible = confirm" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">
                    <x-heroicon-o-eye x-show="!visible" class="w-5 h-5" />
                    <x-heroicon-o-eye-slash x-show="visible" x-cloak class="w-5 h-5" />
                </button>
            </div>
            <x-input-error :messages="$errors->get('password_confirmation')" class="mt-2" />
        </div>

        <div class="flex items-center justify-end mt-4">
            <a class="underline text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800" href="{{ route('login') }}">
                {{ __('¿Ya estás registrado?') }}
            </a>

            <x-primary-button class="ms-4">
                {{ __('Registrar') }}
            </x-primary-button>
        </div>
    </form>
</x-guest-layout>