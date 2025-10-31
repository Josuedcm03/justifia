<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('estudiante.solicitudes.index', ['estado' => request()->query('estado', 'pendiente')]) }}" class="flex items-center text-base text-gray-200 hover:text-[#006b75] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8 text-[#212121] dark:text-white space-y-6">
                <h3 class="flex justify-center text-3xl font-bold mb-6 text-[#0099a8] dark:text-[#40c4d0]">
                    {{ __('Crear Solicitud de Justificación') }}
                </h3>

                <p class="text-sm text-center">¿Necesitas ayuda? <a href="https://example.com/docs/solicitudes" target="_blank" class="text-[#0099a8] underline">Consulta la documentación</a>.</p>

                <form method="POST" action="{{ route('estudiante.solicitudes.store', ['estado' => request()->query('estado', 'pendiente')]) }}" enctype="multipart/form-data" class="space-y-4"
                    data-solicitud-estudiante-frontera
                    data-asignaturas-url="{{ url('estudiante/facultades') }}"
                    data-buscar-docentes-url="{{ url('estudiante/docentes/buscar') }}"
                    data-old-asignatura="{{ old('asignatura_id') }}">
                    @csrf
                    <div>
                        <label for="fecha_ausencia" class="block font-medium mb-1">Fecha de la ausencia</label>
                        <input type="date" name="fecha_ausencia" id="fecha_ausencia" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]" value="{{ old('fecha_ausencia') }}" required>
                        <x-input-error class="mt-2" :messages="$errors->get('fecha_ausencia')" />
                    </div>

                    <div>
                        <label for="docente_input" class="block font-medium mb-1">Docente</label>
                        <input id="docente_input" list="docentes-list" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]" placeholder="Escribe para buscar" autocomplete="off">
                        <datalist id="docentes-list">
                            @foreach ($docentes as $docente)
                                <option data-id="{{ $docente->id }}" value="{{ $docente->usuario->name }}"></option>
                            @endforeach
                        </datalist>
                        <input type="hidden" id="docente_id" name="docente_id" value="{{ old('docente_id') }}">
                        <x-input-error class="mt-2" :messages="$errors->get('docente_id')" />
                    </div>

                    <div>
<label for="facultad_id" class="block font-medium mb-1">Facultad</label>
                        <select id="facultad_id" name="facultad_id" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                            <option value="">Seleccionar Facultad</option>
                            @foreach ($facultades as $facultad)
                                <option value="{{ $facultad->id }}" @selected(old('facultad_id') == $facultad->id)>{{ $facultad->nombre }}</option>
                            @endforeach
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('facultad_id')" />
                    </div>

                    <div>
                        <label for="asignatura_id" class="block font-medium mb-1">Asignatura</label>
                        <select id="asignatura_id" name="asignatura_id" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                            <option value="">Seleccionar Asignatura</option>
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('asignatura_id')" />
                    </div>

                    <div>
                                                <label for="tipo_constancia_id" class="block font-medium mb-1">Tipo de constancia</label>
                        <select id="tipo_constancia_id" name="tipo_constancia_id" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                            <option value="">Seleccionar Tipo de Constancia</option>
                            @foreach ($TiposConstancia as $tipo)
                                <option value="{{ $tipo->id }}" @selected(old('tipo_constancia_id') == $tipo->id)>
                                    {{ $tipo->nombre }}
                                </option>
                            @endforeach
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('tipo_constancia_id')" />
                    </div>

                    <div x-data="{ fileName: '' }">
                        <label for="constancia" class="block font-medium mb-1">Constancia (PDF, JPG, JPEG)</label>
                        <label for="constancia" class="inline-flex items-center px-4 py-2 mb-4 bg-[#6E7881] hover:bg-[#007e8b] text-white rounded-md shadow cursor-pointer">
                            <x-heroicon-o-arrow-up-tray class="w-5 h-5 mr-2" />
                            <span x-text="fileName || 'Cargar constancia'"></span>
                        </label>
                        <input id="constancia" name="constancia" type="file" accept=".pdf,.jpg,.jpeg,.png" class="hidden" x-on:change="fileName = $event.target.files[0]?.name">

                    <div>
                    <label for="observaciones" class="block font-medium mb-1">Notas adicionales</label>
                        <textarea id="observaciones" name="observaciones" rows="3" placeholder="Información complementaria..." class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8] resize-y">{{ old('observaciones') }}</textarea>
                        <x-input-error class="mt-2" :messages="$errors->get('observaciones')" />
                    </div>

                    <div class="flex justify-end pt-4">
                        <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] transition font-semibold">
                            {{ __('Enviar Solicitud') }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>