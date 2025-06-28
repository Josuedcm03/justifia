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
                <h3 class=" flex justify-center text-3xl font-bold mb-6 text-[#0099a8] dark:text-[#40c4d0]">
                    {{ __('Modificar Solicitud') }}
                </h3>

                <form method="POST" action="{{ route('estudiante.solicitudes.update', ['solicitud' => $solicitud, 'estado' => request()->query('estado', 'pendiente')]) }}" enctype="multipart/form-data" class="space-y-4"
                    data-solicitud-estudiante-frontera data-update="true"
                    data-asignaturas-url="{{ url('estudiante/docentes') }}"
                    data-old-asignatura="{{ old('docente_asignatura_id', $solicitud->docente_asignatura_id) }}">
                    @csrf
                    @method('PUT')
                    <div>
                        <label for="fecha_ausencia" class="block font-medium mb-1">Fecha de la ausencia</label>
                        <input type="date" name="fecha_ausencia" id="fecha_ausencia" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]" value="{{ old('fecha_ausencia', $solicitud->fecha_ausencia) }}" required>
                        <x-input-error class="mt-2" :messages="$errors->get('fecha_ausencia')" />
                    </div>

                    <div>
                        <label for="docente_id" class="block font-medium mb-1">Docente</label>
                        <select id="docente_id" name="docente_id" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                            <option value="">Seleccionar Docente</option>
                            @foreach ($docentes as $docente)
                                <option value="{{ $docente->id }}" @selected(old('docente_id', $solicitud->docenteAsignatura->docente_id) == $docente->id)>
                                    {{ $docente->usuario->name }}
                                </option>
                            @endforeach
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('docente_id')" />
                    </div>

                    <div>
                        <label for="docente_asignatura_id" class="block font-medium mb-1">Asignatura</label>
                        <select id="docente_asignatura_id" name="docente_asignatura_id" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                            <option value="">Seleccionar Asignatura</option>
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('docente_asignatura_id')" />
                    </div>

                    <div>
                        <label for="tipo_constancia_id" class="block font-medium mb-1">Tipo de constancia</label>
                        <select id="tipo_constancia_id" name="tipo_constancia_id" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                            <option value="">Seleccionar Tipo de Constancia</option>
                            @foreach ($TiposConstancia as $tipo)
                                <option value="{{ $tipo->id }}" @selected(old('tipo_constancia_id', $solicitud->tipo_constancia_id) == $tipo->id)>
                                    {{ $tipo->nombre }}
                                </option>
                            @endforeach
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('tipo_constancia_id')" />
                    </div>

                    <div class="space-y-2">
                        <label class="block font-medium">Constancia adjunta</label>
                        @php $ext = strtolower(pathinfo($solicitud->constancia, PATHINFO_EXTENSION)); @endphp
                        @if (in_array($ext, ['jpg', 'jpeg', 'png']))
                            <img
                                src="{{ Storage::url($solicitud->constancia) }}"
                                alt="Constancia"
                                class="max-h-52 rounded cursor-pointer"
                                x-data
                                x-on:click="$dispatch('open-modal', 'ver-constancia')"
                            >
                        @else
                            <button
                                type="button"
                                class="text-[#0099a8] underline"
                                x-data
                                x-on:click="$dispatch('open-modal', 'ver-constancia')"
                            >Ver constancia</button>
                        @endif
                        <x-modal name="ver-constancia" focusable>
                            <div class="p-4" x-data="{ zoom: 2 }">
                                @if (in_array($ext, ['jpg', 'jpeg', 'png']))
                                    <div class="relative overflow-auto">
                                        <img src="{{ Storage::url($solicitud->constancia) }}" alt="Constancia" class="max-h-[80vh] mx-auto transition-transform" :style="`transform: scale(${zoom})`">
                                        <button type="button" class="absolute top-2 right-2 bg-white dark:bg-gray-700 p-1 rounded-full shadow" x-on:click="zoom = zoom === 1 ? 2 : 1">
                                            <x-heroicon-o-magnifying-glass-plus class="w-5 h-5" x-show="zoom === 1" />
                                            <x-heroicon-o-magnifying-glass-minus class="w-5 h-5" x-show="zoom > 1" />
                                        </button>
                                    </div>
                                @elseif ($ext === 'pdf')
                                    <iframe src="{{ Storage::url($solicitud->constancia) }}" class="w-full h-[80vh]"></iframe>
                                @else
                                    <a href="{{ Storage::url($solicitud->constancia) }}" target="_blank" class="text-[#0099a8] underline">Abrir archivo</a>
                                @endif
                                <div class="mt-4 text-right">
                                    <x-secondary-button x-on:click="$dispatch('close')">Cerrar</x-secondary-button>
                                </div>
                            </div>
                        </x-modal>
                    </div>

                    <div x-data="{ fileName: '', remove: false }" class="space-y-2">
                        <label for="constancia" class="inline-flex items-center px-4 py-2 bg-[#6E7881] hover:bg-[#007e8b] text-white rounded-md shadow cursor-pointer">
                            <x-heroicon-o-arrow-up-tray class="w-5 h-5 mr-2" />
                            <span x-text="fileName || 'Actualizar Constancia'"></span>
                        </label>
                        <input id="constancia" name="constancia" type="file" accept=".pdf,.jpg,.jpeg" class="hidden" x-on:change="fileName = $event.target.files[0]?.name">
                    </div>

                    <div>
                        <label for="observaciones" class="block font-medium mb-1">Notas adicionales</label>
                        <textarea id="observaciones" name="observaciones" rows="3" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8] resize-y">{{ old('observaciones', $solicitud->observaciones) }}</textarea>
                        <x-input-error class="mt-2" :messages="$errors->get('observaciones')" />
                    </div>


                    <div class="flex justify-between pt-4">
                        <button type="button" id="eliminar-btn" class="bg-[#0b545b] text-white px-6 py-2 rounded-md shadow hover:bg-[#094b51] transition font-semibold">
                            {{ __('Eliminar Solicitud') }}
                        </button>
                        <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] transition font-semibold">
                            {{ __('Guardar Cambios') }}
                        </button>
                    </div>
                </form>

                <form id="eliminar-form" method="POST" action="{{ route('estudiante.solicitudes.destroy', ['solicitud' => $solicitud, 'estado' => request()->query('estado', 'pendiente')]) }}" class="hidden">
                    @csrf
                    @method('DELETE')
                </form>
            </div>
        </div>
    </div>
</x-app-layout>