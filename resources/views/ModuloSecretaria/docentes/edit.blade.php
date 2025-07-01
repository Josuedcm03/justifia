<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('secretaria.docentes.index') }}" class="flex items-center text-base text-gray-200 hover:text-[#006b75] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-md mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8">
                <form method="POST" action="{{ route('secretaria.docentes.update', $docente) }}" class="space-y-4">
                    @csrf
                    @method('PATCH')
                    <div>
                        <label for="cif" class="block font-medium mb-1">CIF</label>
                        <input type="text" name="cif" id="cif" value="{{ old('cif', $docente->cif) }}" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]" required>
                        <x-input-error class="mt-2" :messages="$errors->get('cif')" />
                    </div>
                    <div>
                        <label for="name" class="block font-medium mb-1">Nombre</label>
                        <input type="text" name="name" id="name" value="{{ old('name', $docente->usuario?->name) }}" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]" required>
                        <x-input-error class="mt-2" :messages="$errors->get('name')" />
                    </div>
                    <div>
                        <label for="email" class="block font-medium mb-1">Correo</label>
                        <input type="email" name="email" id="email" value="{{ old('email', $docente->usuario?->email) }}" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]" required>
                        <x-input-error class="mt-2" :messages="$errors->get('email')" />
                    </div>
                    <div class="flex justify-end pt-4">
                        <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] font-semibold">Actualizar</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>