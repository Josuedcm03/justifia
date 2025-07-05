<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('docente.solicitudes.index') }}" class="flex items-center text-base text-gray-200 hover:text-[#006b75] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8 text-[#212121] dark:text-white space-y-4">
                <h3 class="flex justify-center text-3xl font-bold mb-6 text-[#0099a8] dark:text-[#40c4d0]">{{ __('Detalles de Solicitud a Reprogramar') }}</h3>

                
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
                <p><strong>Fecha de ausencia:</strong> {{ \Illuminate\Support\Carbon::parse($solicitud->fecha_ausencia)->locale('es')->isoFormat('dddd, DD [de] MMMM') }}</p>

                @if($solicitud->reprogramacion)
                    <h4 class="text-lg font-semibold mt-4">Reprogramación:</h4>
                    <form method="POST" action="{{ route('docente.solicitudes.reprogramacion.update', $solicitud) }}" class="space-y-4" data-reprogramacion-docente-frontera>
                        @csrf
                        @method('PATCH')
                        <div>
                            <label class="block font-medium mb-1">Fecha</label>
                            <input type="date" name="fecha" value="{{ $solicitud->reprogramacion->fecha }}" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                        </div>
                        <div>
                            <label class="block font-medium mb-1">Hora</label>
                            <input type="time" name="hora" value="{{ $solicitud->reprogramacion->hora }}" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                        </div>
                        <div>
                            <label class="block font-medium mb-1">Observaciones</label>
                            <textarea name="observaciones" rows="3" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">{{ $solicitud->reprogramacion->observaciones }}</textarea>
                        </div>
                        <div class="flex justify-end pt-4">
                            <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] transition font-semibold">
                                {{ __('Actualizar') }}
                            </button>
                        </div>
                    </form>
                @else
                    <h4 class="text-lg font-semibold mt-4">Crear Reprogramación:</h4>
                    <form method="POST" action="{{ route('docente.solicitudes.reprogramacion.store', $solicitud) }}" class="space-y-4" data-reprogramacion-docente-frontera>
                        @csrf
                        <div>
                            <label class="block font-medium mb-1">Fecha</label>
                            <input type="date" name="fecha" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                        </div>
                        <div>
                            <label class="block font-medium mb-1">Hora</label>
                            <input type="time" name="hora" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                        </div>
                        <div>
                            <label class="block font-medium mb-1">Observaciones</label>
                            <textarea name="observaciones" rows="3" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]"></textarea>
                        </div>
                        <div class="flex justify-end pt-4">
                            <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] transition font-semibold">
                                {{ __('Guardar') }}
                            </button>
                        </div>
                    </form>
                @endif
            </div>
        </div>
    </div>
</x-app-layout>