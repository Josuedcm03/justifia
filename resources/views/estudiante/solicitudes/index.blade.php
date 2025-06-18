<div x-data="{ estado: 'pendiente',
        titulos: {
            pendiente: 'Solicitudes Pendientes',
            aprobada: 'Solicitudes Aprobadas',
            rechazada: 'Solicitudes Rechazadas'
        } }">
    <x-app-layout>
        <x-slot name="header">
            <h2 class="font-semibold text-xl text-[#212121] dark:text-gray-200 leading-tight" x-text="titulos[estado]"></h2>
        </x-slot>

        <div class="py-12">
            <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-12">
                <div class="flex justify-between flex-wrap mb-6">
<div class="relative" x-data="{open:false}">
    <button @click="open = !open" class="inline-flex items-center px-4 py-2 bg-[#0099a8] hover:bg-[#007e8b] text-white text-sm font-semibold rounded-lg shadow-sm transition">
        <x-heroicon-o-funnel class="w-4 h-4 mr-2" /> Filtrar
        </button>
                    <div x-show="open" x-transition.origin.top.right @click.away="open=false" class="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 border border-[#0099a8] rounded shadow-lg z-20 text-sm text-black dark:text-white" x-cloak>
                        <button class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10" @click="estado='pendiente';open=false">Pendientes</button>
                        <button class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10" @click="estado='aprobada';open=false">Aprobadas</button>
                        <button class="block w-full text-left px-4 py-2 hover:bg-[#0099a8]/10 dark:hover:bg-[#40c4d0]/10" @click="estado='rechazada';open=false">Rechazadas</button>
    </div>
</div>
                <div class="mt-4 sm:mt-0">
                    <a href="{{ route('estudiante.solicitudes.create') }}" class="inline-flex items-center px-4 py-2 bg-[#0099a8] hover:bg-[#007e8b] text-white text-sm font-semibold rounded-lg shadow-sm transition">
                        {{ __('Crear Solicitud de Justificación') }}
                    </a>
                </div>
            </div>

            <!-- Pendientes -->
            <div x-show="estado=='pendiente'" x-cloak>
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                    @forelse($pendientes as $solicitud)
                        <a href="{{ route('estudiante.solicitudes.edit', $solicitud) }}" class="relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-[#0099a8] shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0099a8]">
                            <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 pointer-events-none">
                                <x-heroicon-o-pencil-square class="w-5 h-5 text-[#0099a8]" />
                                <span class="text-xs text-[#0099a8] hidden sm:inline">Modificar Solicitud</span>
                            </div>
                            <p class="mb-1"><strong>Clase:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }}</p>
                            <p class="mb-1"><strong>Grupo:</strong> {{ $solicitud->docenteAsignatura->grupo }}</p>
                            <p class="mb-1"><strong>Docente:</strong> {{ $solicitud->docenteAsignatura->docente->usuario->name }}</p>
                            <p class="mb-2"><strong>Fecha:</strong> {{ $solicitud->fecha_ausencia }}</p>
                            <p><strong>Estado:</strong>
                                <span class="bg-[#0099a8] text-white text-xs px-2 py-1 rounded font-semibold">Pendiente</span>
                            </p>
                        </a>
                    @empty
                        <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay solicitudes pendientes.') }}</p>
                    @endforelse
                </div>
        </div>

<!-- Aprobadas -->
            <div x-show="estado=='aprobada'" x-cloak>
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                    @forelse($aprobadas as $solicitud)
                        <div class="relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-green-500 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out">
                            <p class="mb-1"><strong>Clase:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }}</p>
                            <p class="mb-1"><strong>Grupo:</strong> {{ $solicitud->docenteAsignatura->grupo }}</p>
                            <p class="mb-1"><strong>Docente:</strong> {{ $solicitud->docenteAsignatura->docente->usuario->name }}</p>
                            <p class="mb-2"><strong>Fecha:</strong> {{ $solicitud->fecha_ausencia }}</p>
                            <p><strong>Estado:</strong>
                                <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-semibold">Aprobada</span>
                            </p>
                        </div>
                    @empty
                        <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay solicitudes aprobadas.') }}</p>
                    @endforelse
                </div>
            </div>

<!-- Rechazadas -->
            <div x-show="estado=='rechazada'" x-cloak>
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                    @forelse($rechazadas as $solicitud)
                        <a href="{{ route('estudiante.solicitudes.apelaciones.create', $solicitud) }}" tabindex="0" class="relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-red-400 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400 ">
                            <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 pointer-events-none">
                                <x-heroicon-o-arrow-path class="w-5 h-5 text-red-600" />
                                <span class="text-xs text-red-600 hidden sm:inline">Apelar solicitud</span>
                            </div>
                            <p class="mb-1"><strong>Clase:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }}</p>
                            <p class="mb-1"><strong>Grupo:</strong> {{ $solicitud->docenteAsignatura->grupo }}</p>
                            <p class="mb-1"><strong>Docente:</strong> {{ $solicitud->docenteAsignatura->docente->usuario->name }}</p>
                            <p class="mb-2"><strong>Fecha:</strong> {{ $solicitud->fecha_ausencia }}</p>
                            <p><strong>Estado:</strong>
                                <span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-semibold">Rechazada</span>
                            </p>
                        </a>
                    @empty
                        <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay solicitudes rechazadas.') }}</p>
                    @endforelse
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
</div>