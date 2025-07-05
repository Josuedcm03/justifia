<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('secretaria.solicitudes.index', ['estado' => $estado]) }}" class="flex items-center text-base text-gray-200 hover:text-[#006b75] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12" data-solicitud-secretaria-frontera>
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8 text-[#212121] dark:text-white space-y-4">
                @if ($solicitud->estado === \App\Enums\EstadoSolicitud::Pendiente)
                <h3 class=" flex justify-center text-3xl font-bold mb-6 text-[#0099a8] dark:text-[#40c4d0]">{{ __('Procesar Solicitud') }}</h3>
                @else
                <h3 class="flex justify-center text-3xl font-bold mb-6 text-[#0099a8] dark:text-[#40c4d0]">{{ __('Detalles de Solicitud') }}</h3>
                @endif

                <p class="flex items-center"><strong class="mr-1">CIF:</strong>
                    <span class="mr-1">{{ $solicitud->estudiante->cif }}</span>
                    <button type="button" class="text-gray-500 hover:text-gray-700"
                        x-data
                        x-on:click="navigator.clipboard.writeText('{{ $solicitud->estudiante->cif }}')">
                        <x-heroicon-o-clipboard class="w-5 h-5" />
                    </button>
                </p>
                <p><strong>Estudiante:</strong> {{ $solicitud->estudiante->usuario->name }}</p>
                <p><strong>Asignatura:</strong> {{ $solicitud->asignatura->nombre }}</p>
                <p><strong>Docente:</strong> {{ $solicitud->docente->usuario->name }}</p>
                <p><strong>Fecha de ausencia:</strong> {{ \Illuminate\Support\Carbon::parse($solicitud->fecha_ausencia)->locale('es')->isoFormat('dddd, DD [de] MMMM') }}</p>
                <p><strong>Tipo de constancia:</strong> {{ $solicitud->tipoConstancia->nombre }}</p>
                @if ($solicitud->observaciones)
                <p><strong>Observación del estudiante:</strong> {{ $solicitud->observaciones }}</p>
                @endif
                @if ($solicitud->respuesta)
                <p><strong>Respuesta:</strong> {{ $solicitud->respuesta }}</p>
                @endif
                <div class="space-y-2">
                    <strong>Constancia adjunta:</strong>
                    @php $ext = strtolower(pathinfo($solicitud->constancia, PATHINFO_EXTENSION)); @endphp
                    @if (in_array($ext, ['jpg', 'jpeg', 'png']))
                        <img src="{{ Storage::url($solicitud->constancia) }}" alt="Ver constancia JPG" class="max-h-52 rounded cursor-pointer" x-data x-on:click="$dispatch('open-modal', 'ver-constancia')">
                    @else
                        <button type="button" class="text-[#0099a8] underline" x-data x-on:click="$dispatch('open-modal', 'ver-constancia')">Ver constancia PDF</button>
                    @endif
                    <x-modal name="ver-constancia" focusable>
                        <div class="p-4" x-data="{ zoom: 1 }">
                            @if (in_array($ext, ['jpg', 'jpeg', 'png']))
                                <div class="relative">
                                    <div class="overflow-auto">
                                        <img src="{{ Storage::url($solicitud->constancia) }}"
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
                                <iframe src="{{ Storage::url($solicitud->constancia) }}" class="w-full h-[80vh]"></iframe>
                            @else
                                <p class="text-gray-700 dark:text-gray-300">Archivo no soportado para previsualización.</p>
                            @endif
                            <a href="{{ Storage::url($solicitud->constancia) }}" target="_blank" class="text-[#0099a8] underline block mt-2">Abrir archivo</a>
                            <div class="mt-4 text-right">
                                <x-secondary-button x-on:click="$dispatch('close')">Cerrar</x-secondary-button>
                            </div>
                        </div>
                    </x-modal>
                </div>

                @if ($solicitud->estado === \App\Enums\EstadoSolicitud::Pendiente)
                    <div class="flex justify-end gap-2 pt-4">
                        <form method="POST" action="{{ route('secretaria.solicitudes.update', ['solicitud' => $solicitud, 'estado' => $estado]) }}" id="rechazar-form">
                            @csrf
                            @method('PATCH')
                            <input type="hidden" name="estado" value="rechazada">
                            <input type="hidden" name="respuesta" id="respuesta-input">
                            <button type="button" id="rechazar-btn" class="bg-[#0b545b] text-white px-6 py-2 rounded-md shadow hover:bg-[#094b51] transition font-semibold">
                                {{ __('Rechazar Solicitud') }}
                            </button>
                        </form>
                        <form method="POST" action="{{ route('secretaria.solicitudes.update', ['solicitud' => $solicitud, 'estado' => $estado]) }}" id="aprobar-form">
                            @csrf
                            @method('PATCH')
                            <input type="hidden" name="estado" value="aprobada">
                            <input type="hidden" name="respuesta" id="respuesta-aprobar">
                            <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] transition font-semibold">
                                {{ __('Aprobar Solicitud') }}
                            </button>
                        </form>
                    </div>
                @endif
            </div>
        </div>
    </div>
</x-app-layout>