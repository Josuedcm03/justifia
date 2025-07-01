<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-200 leading-tight">
            {{ __('Gestionar Reprogramaciones') }}
        </h2>
    </x-slot>
    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-8">
            <details class="bg-white/50 dark:bg-gray-800/50 shadow rounded-lg" open>
                <summary class="cursor-pointer px-4 py-2 text-[#0099a8] hover:text-[#007e8b] font-semibold">
                    {{ __('Solicitudes a Reprogramar') }}
                </summary>
                <div class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    @forelse($solicitudesAReprogramar as $solicitud)
                        <a href="{{ route('docente.solicitudes.show', $solicitud) }}" class="relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-yellow-500 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform focus:bg-yellow-100/30 dark:focus:bg-yellow-400/10">
                            <p class="mb-1"><strong>Estudiante:</strong> {{ $solicitud->estudiante->usuario->name }}</p>
                            <p class="mb-1"><strong>Asignatura:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }} - Grupo {{ $solicitud->docenteAsignatura->grupo }}</p>
                            <p class="mb-2"><strong>Fecha ausencia:</strong> {{ \Illuminate\Support\Carbon::parse($solicitud->fecha_ausencia)->locale('es')->isoFormat('dddd, DD [de] MMMM') }}</p>
                            <span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-semibold">Reprogramación Pendiente</span>
                        </a>
                    @empty
                        <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay solicitudes.') }}</p>
                    @endforelse
                </div>
            </details>

            <details class="bg-white/50 dark:bg-gray-800/50 shadow rounded-lg">
                <summary class="cursor-pointer px-4 py-2 text-[#0099a8] hover:text-[#007e8b] font-semibold">
                    {{ __('Reprogramaciones Realizadas') }}
                </summary>
                <div class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    @forelse($reprogramaciones as $reprogramacion)
                        <div data-asistencia-card class="relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-[#0099a8] shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform @if($reprogramacion->asistencia === \App\Enums\EstadoAsistencia::Pendiente) cursor-pointer @endif"
                            @if($reprogramacion->asistencia === \App\Enums\EstadoAsistencia::Pendiente)
                                                                data-asistencia-docente-frontera
                            @endif>

                            
                    @if ($reprogramacion->asistencia === \App\Enums\EstadoAsistencia::Pendiente)
                            <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 pointer-events-none">
                                <x-heroicon-o-clipboard-document-check class="w-5 h-5 text-[#0099a8]" />
                                <span class="text-sm text-[#0099a8] hidden sm:inline">Validar asistencia</span>
                            </div>
                        @endif
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
                            <form method="POST" action="{{ route('docente.solicitudes.reprogramacion.update', $reprogramacion->solicitud) }}" class="hidden" data-asistencia-form>
                                @csrf
                                @method('PATCH')
                                <input type="hidden" name="asistencia">
                            </form>
                            @if($reprogramacion->asistencia !== \App\Enums\EstadoAsistencia::Pendiente)
                                <button type="button" data-asistencia-edit class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                                    <x-heroicon-o-pencil-square class="w-5 h-5 text-[#0099a8]" />
                                    <span class="text-sm text-[#0099a8] hidden sm:inline">Modificar asistencia</span>
                                </button>
                            @endif
                        </div>
                    @empty
                        <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay reprogramaciones.') }}</p>
                    @endforelse
                </div>
            </details>
        </div>
    </div>
</x-app-layout>