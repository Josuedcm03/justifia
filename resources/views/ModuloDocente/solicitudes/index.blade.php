<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-[#212121] dark:text-gray-200 leading-tight">
            {{ __('Gestionar Reprogramaciones') }}
        </h2>
    </x-slot>
    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-12">
            <div>
                <h3 class="text-lg font-semibold mb-4">{{ __('Solicitudes a Reprogramar') }}</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    @forelse($solicitudesAReprogramar as $solicitud)
                        <a href="{{ route('docente.solicitudes.show', $solicitud) }}" class="bg-white dark:bg-gray-800 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out">
                            <p class="mb-1"><strong>Estudiante:</strong> {{ $solicitud->estudiante->usuario->name }}</p>
                            <p class="mb-1"><strong>Asignatura:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }} - Grupo {{ $solicitud->docenteAsignatura->grupo }}</p>
                            <p class="mb-2"><strong>Fecha ausencia:</strong> {{ \Illuminate\Support\Carbon::parse($solicitud->fecha_ausencia)->locale('es')->isoFormat('dddd, DD [de] MMMM') }}</p>
                            <span class="text-sm text-yellow-600">Pendiente</span>
                        </a>
                    @empty
                        <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay solicitudes.') }}</p>
                    @endforelse
                </div>
            </div>

            <div>
                <h3 class="text-lg font-semibold mb-4">{{ __('Reprogramaciones Realizadas') }}</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    @forelse($reprogramaciones as $reprogramacion)
                        <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-5 text-[#212121] dark:text-white @if($reprogramacion->asistencia === \App\Enums\EstadoAsistencia::Pendiente) cursor-pointer @endif"
                            @if($reprogramacion->asistencia === \App\Enums\EstadoAsistencia::Pendiente)
                                x-data
                                x-on:click="$dispatch('open-modal', 'asistencia-{{ $reprogramacion->id }}')"
                            @endif>
                            <p class="mb-1"><strong>Estudiante:</strong> {{ $reprogramacion->solicitud->estudiante->usuario->name }}</p>
                            <p class="mb-1"><strong>Asignatura:</strong> {{ $reprogramacion->solicitud->docenteAsignatura->asignatura->nombre }} - Grupo {{ $reprogramacion->solicitud->docenteAsignatura->grupo }}</p>
                            <p class="mb-1 "><strong>Fecha programada:</strong> {{ \Illuminate\Support\Carbon::parse($reprogramacion->fecha)->locale('es')->isoFormat('dddd, DD [de] MMMM') }} </p>
                            <p class="mb-2"><strong>Hora programada:</strong> {{ $reprogramacion->hora }}</p>
                            <p class="flex items-center"><strong>Asistencia:</strong>
                                @if($reprogramacion->asistencia === \App\Enums\EstadoAsistencia::NoAsistio)
                                    <x-heroicon-o-x-circle class="w-5 h-5 text-red-600 ml-1" />
                                @elseif($reprogramacion->asistencia === \App\Enums\EstadoAsistencia::Asistio)
                                    <x-heroicon-o-check-circle class="w-5 h-5 text-green-600 ml-1" />
                                @else
                                    <x-heroicon-o-ellipsis-horizontal class="w-5 h-5 text-gray-500 ml-1" />
                                @endif
                            </p>
                        </div>
                        @if($reprogramacion->asistencia === \App\Enums\EstadoAsistencia::Pendiente)
                            <x-modal name="asistencia-{{ $reprogramacion->id }}" focusable>
                                <form method="POST" action="{{ route('docente.solicitudes.reprogramacion.update', $reprogramacion->solicitud) }}" class="p-6 space-y-4">
                                    @csrf
                                    @method('PATCH')
                                    <p class="text-center font-semibold">Registrar asistencia</p>
                                    <div class="flex justify-center gap-4">
                                        <button name="asistencia" value="asistio" class="bg-green-600 text-white px-4 py-2 rounded">Asistió</button>
                                        <button name="asistencia" value="no_asistio" class="bg-red-600 text-white px-4 py-2 rounded">No asistió</button>
                                    </div>
                                </form>
                            </x-modal>
                        @endif
                    @empty
                        <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay reprogramaciones.') }}</p>
                    @endforelse
                </div>
            </div>
        </div>
    </div>
</x-app-layout>