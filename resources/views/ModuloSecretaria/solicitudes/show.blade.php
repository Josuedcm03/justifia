<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('secretaria.solicitudes.index', ['estado' => $estado]) }}" class="flex items-center text-sm text-[#0099a8] hover:text-[#007e8b] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12" data-solicitud-secretaria-frontera>
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8 text-[#212121] dark:text-white space-y-4">
                @if ($solicitud->estado === 'pendiente')
                <h3 class=" flex justify-center text-2xl font-bold mb-4 text-[#0099a8] dark:text-[#40c4d0]">{{ __('Procesar Solicitud') }}</h3>
                @else
                <h3 class="flex justify-center text-2xl font-bold mb-4 text-[#0099a8] dark:text-[#40c4d0]">{{ __('Detalles de Solicitud') }}</h3>
                @endif

                <p><strong>Estudiante:</strong> {{ $solicitud->estudiante->usuario->name }} ({{ $solicitud->estudiante->cif }})</p>
                <p><strong>Asignatura:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }}</p>
                <p><strong>Grupo:</strong> {{ $solicitud->docenteAsignatura->grupo }}</p>
                <p><strong>Docente:</strong> {{ $solicitud->docenteAsignatura->docente->usuario->name }}</p>
                <p><strong>Fecha de ausencia:</strong> {{ $solicitud->fecha_ausencia }}</p>
                <p><strong>Tipo de constancia:</strong> {{ $solicitud->tipoConstancia->nombre }}</p>
                <p><strong>Observaciones:</strong> {{ $solicitud->observaciones ?? '-' }}</p>
                @if ($solicitud->respuesta)
                    <p><strong>Respuesta:</strong> {{ $solicitud->respuesta }}</p>
                @endif
                <div class="space-y-2">
                    <label class="block font-medium">Constancia adjunta</label>
                    @php $ext = strtolower(pathinfo($solicitud->constancia, PATHINFO_EXTENSION)); @endphp
                    @if (in_array($ext, ['jpg', 'jpeg', 'png']))
                        <img src="{{ Storage::url($solicitud->constancia) }}" alt="Constancia" class="max-h-52 rounded cursor-pointer" x-data x-on:click="$dispatch('open-modal', 'ver-constancia')">
                    @else
                        <button type="button" class="text-[#0099a8] underline" x-data x-on:click="$dispatch('open-modal', 'ver-constancia')">Ver constancia</button>
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

                @if ($solicitud->estado === 'pendiente')
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