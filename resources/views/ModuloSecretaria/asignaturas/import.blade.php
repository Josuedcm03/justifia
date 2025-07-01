<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('secretaria.asignaturas.index') }}" class="flex items-center text-base text-gray-200 hover:text-[#006b75] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-md mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-5">
                <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">El archivo debe tener una columna llamada <strong>nombre</strong>.</p>
                <form method="POST" action="{{ route('secretaria.asignaturas.import') }}" enctype="multipart/form-data" class="space-y-4">
                    @csrf
                    <input type="file" name="file" accept=".xlsx" required>
                    <div class="flex justify-end pt-4">
                        <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] font-semibold">Importar</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>