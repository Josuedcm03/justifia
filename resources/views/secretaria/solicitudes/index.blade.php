<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <h2 class="font-semibold text-xl text-[#212121] dark:text-gray-200 leading-tight">
                {{ __('Gestionar Solicitudes') }}
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
                    <div x-show="open" x-transition.origin.top.right @click.away="open=false" class="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 border border-[#0099a8] rounded shadow-lg z-20 text-sm text-black dark:text-white" x-cloak>
                        <a href="?estado=pendiente" class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10">Pendientes</a>
                        <a href="?estado=aprobada" class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10">Aprobadas</a>
                        <a href="?estado=rechazada" class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10">Rechazadas</a>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                @forelse($solicitudes as $solicitud)
                    <a href="{{ route('secretaria.solicitudes.show', $solicitud) }}"
                    class="{{
                        match($solicitud->estado) {
                        'pendiente' => 'relative group bg-white dark:bg-gray-800 border-2 border-transparent hover:border-[#0099a8] shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out',
                        'aprobada' => 'bg-white dark:bg-gray-800 border-2 border-transparent hover:border-green-500 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out',
                        'rechazada' => 'bg-white dark:bg-gray-800 border-2 border-transparent hover:border-red-400 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out',
                        }
                    }}">
                        @if ($solicitud->estado === 'pendiente')
                            <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 pointer-events-none">
                                <x-heroicon-o-clipboard-document-check class="w-5 h-5 text-[#0099a8]" />
                                <span class="text-xs text-[#0099a8] hidden sm:inline">Procesar solicitud</span>
                            </div>
                        @endif
                        <p class="mb-1"><strong>Estudiante:</strong> {{ $solicitud->estudiante->usuario->name }}</p>
                        <p class="mb-1"><strong>Asignatura:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }}</p>
                        <p class="mb-1"><strong>Grupo:</strong> {{ $solicitud->docenteAsignatura->grupo }}</p>
                        <p class="mb-1"><strong>Fecha:</strong> {{ $solicitud->fecha_ausencia }}</p>
                        <p><strong>Estado:</strong> <span class="capitalize">{{ $solicitud->estado }}</span></p>
                    </a>
                @empty
                    <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay solicitudes.') }}</p>
                @endforelse
            </div>

            <div>
                {{ $solicitudes->appends(['estado' => $estado])->links() }}
            </div>
        </div>
    </div>
</x-app-layout>