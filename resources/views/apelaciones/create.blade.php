<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('solicitudes.index') }}" class="flex items-center text-sm text-[#0099a8] hover:text-[#007e8b] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
            <h2 class="font-semibold text-xl text-[#212121] dark:text-gray-200 leading-tight">
                {{ __('Apelar Solicitud') }}
            </h2>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8 text-[#212121] dark:text-white space-y-6">
                <h3 class="text-2xl font-bold mb-4 text-[#0099a8] dark:text-[#40c4d0]">
                    {{ __('Crear Apelación') }}
                </h3>

                <form method="POST" action="{{ route('solicitudes.apelaciones.store', $solicitud) }}" class="space-y-4">
                    @csrf
                    <div>
                        <label for="observacion_estudiante" class="block font-medium mb-1">{{ __('Observación') }}</label>
                        <textarea id="observacion_estudiante" name="observacion_estudiante" rows="4" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]" required>{{ old('observacion_estudiante') }}</textarea>
                        <x-input-error class="mt-2" :messages="$errors->get('observacion_estudiante')" />
                    </div>
                    <div class="flex justify-end pt-4">
                        <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] transition font-semibold">
                            {{ __('Enviar Apelación') }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>