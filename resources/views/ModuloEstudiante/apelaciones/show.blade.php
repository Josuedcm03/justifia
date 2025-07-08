<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('estudiante.apelaciones.index') }}" class="flex items-center text-base text-gray-200 hover:text-[#006b75] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8 text-[#212121] dark:text-white space-y-4">
                <h3 class="flex justify-center text-3xl font-bold mb-6 text-[#0099a8] dark:text-[#40c4d0]">{{ __('Detalles de Apelación') }}</h3>


                @if ($apelacion->estado === \App\Enums\EstadoApelacion::Pendiente)
                <form method="POST" action="{{ route('estudiante.solicitudes.apelaciones.update', ['solicitud' => $apelacion->solicitud, 'apelacion' => $apelacion]) }}" class="space-y-4" data-apelacion-estudiante-frontera>
                        @csrf
                        @method('PUT')
                        <div class="bg-gray-100/80 dark:bg-gray-700/80 p-4 rounded-md">
                            <label for="observacion_estudiante" class="block font-medium mb-1">Apelación del Estudiante</label>
                            <textarea id="observacion_estudiante" name="observacion_estudiante" rows="4" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]" required>{{ old('observacion_estudiante', $apelacion->observacion) }}</textarea>
                            <x-input-error class="mt-2" :messages="$errors->get('observacion_estudiante')" />
                        <div class="flex justify-end pt-4">
                            <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] transition font-semibold">
                                {{ __('Guardar Cambios') }}
                            </button>
                        </div>
                        </div>
                        
                    </form>
                @elseif ($apelacion->respuesta && $apelacion->estado !== \App\Enums\EstadoApelacion::Pendiente)
                <div class="bg-gray-100/80 dark:bg-gray-700/80 p-4 rounded-md">
                    <p><strong>Respuesta de la Secretaría:</strong> {{ $apelacion->respuesta }}</p>
                </div>
                @endif
                <div class="mb-4 space-y-4">
                <p><strong>Asignatura:</strong> {{ $apelacion->solicitud->asignatura->nombre }}</p>
                <p><strong>Docente:</strong> {{ $apelacion->solicitud->docente->usuario->name }}</p>
                <p><strong>Fecha de ausencia:</strong> {{ \Illuminate\Support\Carbon::parse($apelacion->solicitud->fecha_ausencia)->locale('es')->isoFormat('dddd, DD [de] MMMM') }}</p>
                </div>

                @php $ext = strtolower(pathinfo($apelacion->solicitud->constancia, PATHINFO_EXTENSION)); @endphp
                <div class="space-y-2">
                    <strong>Constancia {{ $apelacion->solicitud->tipoConstancia->nombre }} adjunta:</strong>
                    @if (in_array($ext, ['jpg', 'jpeg', 'png']))
                        <img src="{{ Storage::url($apelacion->solicitud->constancia) }}" alt="Ver constancia JPG" class="max-h-52 rounded cursor-pointer" x-data x-on:click="$dispatch('open-modal', 'ver-constancia')">
                    @else
                        <button type="button" class="text-[#0099a8] underline" x-data x-on:click="$dispatch('open-modal', 'ver-constancia')">Ver constancia PDF</button>
                    @endif
                    <x-modal name="ver-constancia" focusable>
                        <div class="p-4" x-data="{ zoom: 1 }">
                            @if (in_array($ext, ['jpg', 'jpeg', 'png']))
                                <div class="relative">
                                    <div class="overflow-auto">
                                        <img src="{{ Storage::url($apelacion->solicitud->constancia) }}"
                                            alt="Constancia"
                                            class="max-h-[80vh] mx-auto transition-transform origin-top-left"
                                            :class="zoom === 1 ? 'cursor-zoom-in' : 'cursor-zoom-out'"
                                            :style="`transform: scale(${zoom})`"
                                            x-on:click="zoom = zoom === 1 ? 2 : 1">
                                    </div>
                                    <button type="button" class="absolute top-2 right-5 bg-white dark:bg-gray-700 p-1 rounded-full shadow" x-on:click="zoom = zoom === 1 ? 2 : 1">
                                        <x-heroicon-o-magnifying-glass-plus class="w-5 h-5" x-show="zoom === 1" />
                                        <x-heroicon-o-magnifying-glass-minus class="w-5 h-5" x-show="zoom > 1" />
                                    </button>
                                </div>
                            @elseif ($ext === 'pdf')
                                <iframe src="{{ Storage::url($apelacion->solicitud->constancia) }}" class="w-full h-[80vh]"></iframe>
                            @else
                                <p class="text-gray-700 dark:text-gray-300">Archivo no soportado para previsualización.</p>
                            @endif
                            <a href="{{ Storage::url($apelacion->solicitud->constancia) }}" target="_blank" class="text-[#0099a8] underline block mt-2">Abrir archivo</a>
                            <div class="mt-4 text-right">
                                <x-secondary-button x-on:click="$dispatch('close')">Cerrar</x-secondary-button>
                            </div>
                        </div>
                    </x-modal>
                </div>
                <details class="mt-4">
                    <summary class="cursor-pointer text-[#0099a8] hover:text-[#007e8b] font-semibold">Ver historial de respuestas</summary>
                    <div class="mt-2 space-y-2">
                        @foreach ($historial as $item)
                            <div>
                                <span class="font-medium">{{ $item['autor'] === 'estudiante' ? 'Estudiante:' : 'Secretaría:' }}</span>
                                <p class="ml-4">{{ $item['mensaje'] }}</p>
                            </div>
                        @endforeach
                    </div>
                </details>
            </div>
        </div>
    </div>
</x-app-layout>