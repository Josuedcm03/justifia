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
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8 text-[#212121] dark:text-white space-y-4">
                <h3 class="flex justify-center text-3xl font-bold mb-6 text-[#0099a8] dark:text-[#40c4d0]">{{ __('Detalles de Solicitud') }}</h3>

                <p><strong>Asignatura:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }}</p>
                <p><strong>Grupo:</strong> {{ $solicitud->docenteAsignatura->grupo }}</p>
                <p><strong>Docente:</strong> {{ $solicitud->docenteAsignatura->docente->usuario->name }}</p>
                <p><strong>Fecha de ausencia:</strong> {{ $solicitud->fecha_ausencia }}</p>
                <p><strong>Tipo de constancia:</strong> {{ $solicitud->tipoConstancia->nombre }}</p>
                <p><strong>Observaciones:</strong> {{ $solicitud->observaciones ?? '-' }}</p>
                @if ($solicitud->respuesta)
                    <p><strong>Respuesta:</strong> {{ $solicitud->respuesta }}</p>
                @endif

                @php $ext = strtolower(pathinfo($solicitud->constancia, PATHINFO_EXTENSION)); @endphp
                <div class="space-y-2">
                    <label class="block font-medium">Constancia adjunta</label>
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
            </div>
        </div>
    </div>
</x-app-layout>