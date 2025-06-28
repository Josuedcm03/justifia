<div x-data="{ estado: '{{ $estado }}',
        titulos: {
            pendiente: 'Mis Solicitudes Pendientes',
            aprobada: 'Mis Solicitudes Aprobadas',
            rechazada: 'Mis Solicitudes Rechazadas'
        } }">
    <x-app-layout>
        <x-slot name="header">
            <h2 class="font-semibold text-xl text-gray-200 leading-tight" x-text="titulos[estado]"></h2>
        </x-slot>

        <div class="py-12">
            <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-12">
                <div class="flex justify-between flex-wrap mb-6">
                    <div class="relative" x-data="{open:false}">
                        <button @click="open = !open" class="inline-flex items-center px-4 py-2 bg-[#0099a8] hover:bg-[#007e8b] text-white text-sm font-semibold rounded-lg shadow-sm transition">
                            <x-heroicon-o-funnel class="w-4 h-4 mr-2" /> Filtrar
                        </button>
                        <div x-show="open" x-transition.origin.top.left @click.away="open=false" class="absolute left-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 border border-[#0099a8] rounded shadow-lg z-20 text-sm text-black dark:text-white" x-cloak>
                            <a href="?estado=pendiente" class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10">Pendientes</a>
                            <a href="?estado=aprobada" class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10">Aprobadas</a>
                            <a href="?estado=rechazada" class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10">Rechazadas</a>
                        </div>
                    </div>
                    <div class="mt-4 sm:mt-0">
                        <a href="{{ route('estudiante.solicitudes.create') }}" class="inline-flex items-center px-4 py-2 bg-[#0099a8] hover:bg-[#007e8b] text-white text-sm font-semibold rounded-lg shadow-sm transition">
                            {{ __('Crear Solicitud de Justificación') }}
                        </a>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                    @forelse($solicitudes as $solicitud)
                        <a href="{{ match($estado) {
                                'pendiente' => route('estudiante.solicitudes.edit', ['solicitud' => $solicitud, 'estado' => $estado]),
                                'aprobada' => route('estudiante.solicitudes.show', ['solicitud' => $solicitud, 'estado' => $estado]),
                                'rechazada' => route('estudiante.solicitudes.apelaciones.create', ['solicitud' => $solicitud, 'estado' => $estado]),
                            } }}"
                            class="{{
                                match($estado) {
                                    'pendiente' => 'relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-yellow-500 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out focus:bg-yellow-100/30 dark:focus:bg-yellow-400/10',
                                    'aprobada' => 'relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-green-500 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out focus:bg-green-100/30 dark:focus:bg-green-400/10',
                                    'rechazada' => 'relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-red-400 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out focus:bg-red-100/30 dark:focus:bg-red-400/10',
                                }
                            }}" {{ $estado === 'rechazada' ? 'tabindex=0' : '' }}>
                            <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 pointer-events-none">
                                @if ($estado === 'pendiente')
                                    <x-heroicon-o-pencil-square class="w-5 h-5 text-yellow-600" />
                                    <span class="text-xs text-yellow-600 hidden sm:inline">Modificar Solicitud</span>
                                @elseif ($estado === 'aprobada')
                                    <x-heroicon-o-eye class="w-5 h-5 text-green-600" />
                                    <span class="text-xs text-green-600 hidden sm:inline">Ver detalles</span>
                                @else
                                    <x-heroicon-o-arrow-path class="w-5 h-5 text-red-600" />
                                    <span class="text-xs text-red-600 hidden sm:inline">Apelar solicitud</span>
                                @endif
                            </div>
                            <p class="mb-1"><strong>Asignatura:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }} - Grupo {{ $solicitud->docenteAsignatura->grupo }}</p>
                            <p class="mb-1"><strong>Docente:</strong> {{ $solicitud->docenteAsignatura->docente->usuario->name }}</p>
                            <p class="mb-2"><strong>Fecha:</strong> {{ $solicitud->fecha_ausencia }}</p>
                            <p><strong>Estado:</strong>
                                @if ($estado === 'pendiente')
                                    <span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-semibold">Pendiente</span>
                                @elseif ($estado === 'aprobada')
                                    <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-semibold">Aprobada</span>
                                @else
                                    <span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-semibold">Rechazada</span>
                                @endif
                            </p>
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
</div>