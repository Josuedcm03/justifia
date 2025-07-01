<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('secretaria.apelaciones.index', ['estado' => $estado]) }}" class="flex items-center text-base text-gray-200 hover:text-[#006b75] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12" data-apelacion-secretaria-frontera>
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8 text-[#212121] dark:text-white space-y-4">
                @if ($apelacion->estado === \App\Enums\EstadoApelacion::Pendiente)
                    <h3 class="flex justify-center text-3xl font-bold mb-6 text-[#0099a8] dark:text-[#40c4d0]">{{ __('Procesar Apelación') }}</h3>
                @else
                    <h3 class="flex justify-center text-3xl font-bold mb-6 text-[#0099a8] dark:text-[#40c4d0]">{{ __('Detalles de Apelación') }}</h3>
                @endif

                @if($apelacion->estado === \App\Enums\EstadoApelacion::Pendiente)
                <div class="bg-gray-100/80 dark:bg-gray-700/80 p-4 rounded-md">
                    <p><strong>Apelación del estudiante:</strong> {{ $apelacion->observacion }}</p>
                </div>
                @elseif ($apelacion->respuesta && $apelacion->estado !== \App\Enums\EstadoApelacion::Pendiente)
                    <div class="bg-gray-100/80 dark:bg-gray-700/80 p-4 rounded-md">
                        <p><strong>Respuesta de la Secretaría:</strong> {{ $apelacion->respuesta }}</p>
                    </div>
                @endif

                <p class="flex items-center"><strong class="mr-1">CIF:</strong>
                    <span class="mr-1">{{ $apelacion->solicitud->estudiante->cif }}</span>
                    <button type="button" class="text-gray-500 hover:text-gray-700"
                        x-data
                        x-on:click="navigator.clipboard.writeText('{{ $apelacion->solicitud->estudiante->cif }}')">
                        <x-heroicon-o-clipboard class="w-5 h-5" />
                    </button>
                </p>
                <p><strong>Estudiante:</strong> {{ $apelacion->solicitud->estudiante->usuario->name }}</p>
                <p><strong>Asignatura:</strong> {{ $apelacion->solicitud->docenteAsignatura->asignatura->nombre }} - Grupo {{ $apelacion->solicitud->docenteAsignatura->grupo }}</p>
                <p><strong>Docente:</strong> {{ $apelacion->solicitud->docenteAsignatura->docente->usuario->name }}</p>
                <p><strong>Fecha de ausencia:</strong> {{ \Illuminate\Support\Carbon::parse($apelacion->solicitud->fecha_ausencia)->locale('es')->isoFormat('dddd, DD [de] MMMM') }}</p>
                <p><strong>Tipo de constancia:</strong> {{ $apelacion->solicitud->tipoConstancia->nombre }}</p>

                @php $ext = strtolower(pathinfo($apelacion->solicitud->constancia, PATHINFO_EXTENSION)); @endphp
                <div class="space-y-2">
                    <p><strong>Constancia adjunta:</strong></p></label>
                    @if (in_array($ext, ['jpg', 'jpeg', 'png']))
                        <img src="{{ Storage::url($apelacion->solicitud->constancia) }}" alt="Constancia" class="max-h-52 rounded cursor-pointer" x-data x-on:click="$dispatch('open-modal', 'ver-constancia')">
                    @else
                        <button type="button" class="text-[#0099a8] underline" x-data x-on:click="$dispatch('open-modal', 'ver-constancia')">Ver constancia PDF</button>
                    @endif
                    <x-modal name="ver-constancia" focusable>
                        <div class="p-4" x-data="{ zoom: 1 }">
                            @if (in_array($ext, ['jpg', 'jpeg', 'png']))
                                <div class="relative overflow-auto">
                                    <img src="{{ Storage::url($apelacion->solicitud->constancia) }}"
                                        alt="Constancia"
                                        class="max-h-[80vh] mx-auto transition-transform origin-top-left"
                                        :class="zoom === 1 ? 'cursor-zoom-in' : 'cursor-zoom-out'"
                                        :style="`transform: scale(${zoom})`"
                                        x-on:click="zoom = zoom === 1 ? 2 : 1">
                                    <button type="button" class="absolute top-2 right-2 bg-white dark:bg-gray-700 p-1 rounded-full shadow" x-on:click="zoom = zoom === 1 ? 2 : 1">
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

                @if ($apelacion->estado === \App\Enums\EstadoApelacion::Pendiente)
                    <div class="flex justify-end gap-2 pt-4">
                        <form method="POST" action="{{ route('secretaria.apelaciones.update', ['apelacion' => $apelacion, 'estado' => $estado]) }}" id="rechazar-form">
                            @csrf
                            @method('PATCH')
                            <input type="hidden" name="estado" value="rechazada">
                            <input type="hidden" name="respuesta" id="respuesta-input">
                            <button type="button" id="rechazar-btn" class="bg-[#0b545b] text-white px-6 py-2 rounded-md shadow hover:bg-[#094b51] transition font-semibold">
                                {{ __('Rechazar Apelación') }}
                            </button>
                        </form>
                        <form method="POST" action="{{ route('secretaria.apelaciones.update', ['apelacion' => $apelacion, 'estado' => $estado]) }}" id="aprobar-form">
                            @csrf
                            @method('PATCH')
                            <input type="hidden" name="estado" value="aprobada">
                            <input type="hidden" name="respuesta" id="respuesta-aprobar">
                            <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] transition font-semibold">
                                {{ __('Aprobar Apelación') }}
                            </button>
                        </form>
                    </div>
                @endif
            </div>
        </div>
    </div>
</x-app-layout>