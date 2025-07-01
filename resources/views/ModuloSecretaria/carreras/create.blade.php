<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('secretaria.carreras.index') }}" class="flex items-center text-base text-gray-200 hover:text-[#006b75] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-md mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8">
                <form method="POST" action="{{ route('secretaria.carreras.store') }}" class="space-y-4">
                    @csrf
                    <div>
                        <label for="nombre" class="block font-medium mb-1">Nombre</label>
                        <input type="text" name="nombre" id="nombre" value="{{ old('nombre') }}" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]" required>
                        <x-input-error class="mt-2" :messages="$errors->get('nombre')" />
                    </div>
                    <div>
                        <label for="facultad_id" class="block font-medium mb-1">Facultad</label>
                        <select name="facultad_id" id="facultad_id" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]" required>
                            <option value="">Seleccione una facultad</option>
                            @foreach($facultades as $facultad)
                                <option value="{{ $facultad->id }}" @selected(old('facultad_id') == $facultad->id)>{{ $facultad->nombre }}</option>
                            @endforeach
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('facultad_id')" />
                    </div>
                    <div class="flex justify-end pt-4">
                        <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] font-semibold">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>