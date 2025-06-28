<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <h2 class="font-semibold text-xl text-[#212121] dark:text-gray-200 leading-tight">
                {{ __('Gestionar Apelaciones') }}
            </h2>
        </div>
    </x-slot>

    <div class="py-12" x-data="{estado: '{{ $estado }}'}">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-12">
            <div class="flex justify-between flex-wrap mb-6">
                <div class="relative" x-data="{open:false}">
                    <button @click="open = !open" class="inline-flex items-center px-4 py-2 bg-[#0099a8] hover:bg-[#007e8b] text-white text-sm font-semibold rounded-lg shadow-sm transition">
                        <x-heroicon-o-funnel class="w-4 h-4 mr-2" /> {{ __('Filtrar') }}
                    </button>
                    <div x-show="open" x-transition.origin.top.left @click.away="open=false" class="absolute left-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 border border-[#0099a8] rounded shadow-lg z-20 text-sm text-black dark:text-white" x-cloak>
                        <a href="?estado=pendiente" class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10">Pendientes</a>
                        <a href="?estado=aprobada" class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10">Aprobadas</a>
                        <a href="?estado=rechazada" class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10">Rechazadas</a>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                @forelse($apelaciones as $apelacion)
                    <a href="{{ route('secretaria.apelaciones.show', ['apelacion' => $apelacion, 'estado' => $estado]) }}"
                        class="{{
                            match($apelacion->estado->value) {
                                'pendiente' => 'relative group bg-white dark:bg-gray-800 border-2 border-transparent hover:border-[#0099a8] shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out',
                                'aprobada' => ' relative group bg-white dark:bg-gray-800 border-2 border-transparent hover:border-green-500 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out',
                                'rechazada' => 'relative group bg-white dark:bg-gray-800 border-2 border-transparent hover:border-red-400 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out',
                            }
                        }}">
                        @if ($apelacion->estado === \App\Enums\EstadoApelacion::Pendiente)
                            <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 pointer-events-none">
                                <x-heroicon-o-clipboard-document-check class="w-5 h-5 text-[#0099a8]" />
                                <span class="text-xs text-[#0099a8] hidden sm:inline">Procesar apelación</span>
                            </div>
                        @elseif ($apelacion->estado === \App\Enums\EstadoApelacion::Aprobada)
                        <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 pointer-events-none">
                                <x-heroicon-o-eye class="w-5 h-5 text-green-600" />
                                <span class="text-xs text-green-600 hidden sm:inline">Ver detalles</span>
                            </div>
                        @elseif ($apelacion->estado === \App\Enums\EstadoApelacion::Rechazada)
                        <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 pointer-events-none">
                                <x-heroicon-o-eye class="w-5 h-5 text-red-600" />
                                <span class="text-xs text-red-600 hidden sm:inline">Ver detalles</span>
                            </div>
                        @endif
                        <p class="mb-1"><strong>Estudiante:</strong> {{ $apelacion->solicitud->estudiante->usuario->name }}</p>
                        <p class="mb-1"><strong>Asignatura:</strong> {{ $apelacion->solicitud->docenteAsignatura->asignatura->nombre }}</p>
                        <p class="mb-2"><strong>Fecha:</strong> {{ $apelacion->solicitud->fecha_ausencia }}</p>
                        <p><strong>Estado:</strong>
                        @if ($apelacion->estado === \App\Enums\EstadoApelacion::Pendiente)
                        <span class="bg-[#0099a8] text-white text-xs px-2 py-1 rounded font-semibold">{{ ucfirst($apelacion->estado->value) }}</span>
                        @elseif ($apelacion->estado === \App\Enums\EstadoApelacion::Aprobada)
                        <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-semibold">{{ ucfirst($apelacion->estado->value) }}</span>
                        @elseif ($apelacion->estado === \App\Enums\EstadoApelacion::Rechazada)
                        <span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-semibold">{{ ucfirst($apelacion->estado->value) }}</span>
                        @endif
                    </p>
                    </a>
                @empty
                    <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay apelaciones.') }}</p>
                @endforelse
            </div>

            <div>
                {{ $apelaciones->appends(['estado' => $estado])->links() }}
            </div>
        </div>
    </div>
</x-app-layout>