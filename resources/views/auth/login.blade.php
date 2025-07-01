<x-guest-layout>
    <!-- Session Status -->
    <x-auth-session-status class="mb-4" :status="session('status')" />

    <form method="POST" action="{{ route('login') }}">
        @csrf

        <!-- Login -->
        <div class="mb-4">
            <x-input-label for="login" :value="__('CIF o Correo institucional')" />
            <div class="relative">
                <x-heroicon-o-user class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#31c0d3]" />
                <input id="login" class="block mt-1 w-full ps-10" type="text" name="login" :value="old('login')" required autofocus autocomplete="username" />
            </div>
            <x-input-error :messages="$errors->get('login')" class="mt-2" />
        </div>

        <!-- Password -->
        <div class="mb-4" x-data="{ visible: false }">
            <x-input-label for="password" :value="__('Password')" />

            <div class="relative">
                <x-heroicon-o-lock-closed x-show="!visible" class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#31c0d3]" />
                <x-heroicon-o-lock-open x-show="visible" x-cloak class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#31c0d3]" />
                <input :type="visible ? 'text' : 'password'" id="password" class="block mt-1 w-full ps-10 pe-10" name="password" required autocomplete="current-password" />
                <button type="button" @click="visible = !visible" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">
                    <x-heroicon-o-eye x-show="!visible" class="w-5 h-5" />
                    <x-heroicon-o-eye-slash x-show="visible" x-cloak class="w-5 h-5" />
                </button>
            </div>

            <x-input-error :messages="$errors->get('password')" class="mt-2" />
        </div>

        <!-- Remember Me -->
        <div class="block mt-4">
            <label for="remember_me" class="inline-flex items-center">
                <input id="remember_me" type="checkbox" class="rounded dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-indigo-600 shadow-sm focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:focus:ring-offset-gray-800" name="remember">
                <span class="ms-2 text-sm text-gray-600 dark:text-gray-400">{{ __('Remember me') }}</span>
            </label>
        </div>

        <div class="flex items-center justify-end mt-4">
            @if (Route::has('password.request'))
                <a class="underline text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800" href="{{ route('password.request') }}">
                    {{ __('Forgot your password?') }}
                </a>
            @endif

            <x-primary-button class="ms-3">
                {{ __('Log in') }}
            </x-primary-button>
        </div>
    </form>
</x-guest-layout>
