<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <h2 class="font-semibold text-xl text-gray-200 leading-tight">
                {{ __('Mis Apelaciones') }}
            </h2>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-8">
            @php
                $estados = ['pendiente' => 'Pendientes', 'aprobada' => 'Aprobadas', 'rechazada' => 'Rechazadas'];
            @endphp

            @foreach ($estados as $clave => $titulo)
                <details class="bg-white/50 dark:bg-gray-800/50 shadow rounded-lg" @if ($loop->first) open @endif>
                    <summary class="cursor-pointer px-4 py-2 text-[#0099a8] hover:text-[#007e8b] font-semibold">
                        {{ $titulo }}
                    </summary>
                    <div class="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        @forelse($apelaciones[$clave] ?? [] as $apelacion)
                            <a href="{{ $apelacion->estado === \App\Enums\EstadoApelacion::Rechazada ? route('estudiante.solicitudes.apelaciones.create', ['solicitud' => $apelacion->solicitud, 'estado' => 'rechazada']) : route('estudiante.apelaciones.show', $apelacion) }}"
                                class="{{
                                    match($apelacion->estado->value) {
                                        'pendiente' => 'relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-yellow-500 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform focus:bg-yellow-100/30 dark:focus:bg-yellow-400/10',
                                        'aprobada' => 'relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-green-500 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform focus:bg-green-100/30 dark:focus:bg-green-400/10',
                                        'rechazada' => 'relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-red-400 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform focus:bg-red-100/30 dark:focus:bg-red-400/10',
                                    }
                                }}">
                                @if ($apelacion->estado === \App\Enums\EstadoApelacion::Aprobada)
                                    <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 pointer-events-none">
                                        <x-heroicon-o-eye class="w-5 h-5 text-green-600" />
                                        <span class="text-sm text-green-600 hidden sm:inline">Ver detalles</span>
                                    </div>
                                @elseif ($apelacion->estado === \App\Enums\EstadoApelacion::Rechazada)
                                    <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 pointer-events-none">
                                        <x-heroicon-o-arrow-path class="w-5 h-5 text-red-600" />
                                        <span class="text-sm text-red-600 hidden sm:inline">Apelar nuevamente</span>
                                    </div>
                                @else
                                    <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 pointer-events-none">
                                        <x-heroicon-o-eye class="w-5 h-5 text-yellow-600" />
                                        <span class="text-sm text-yellow-600 hidden sm:inline">Ver detalles</span>
                                    </div>
                                @endif
                                <p class="mb-1"><strong>Asignatura:</strong> {{ $apelacion->solicitud->asignatura->nombre }}</p>
                                <p class="mb-1"><strong>Docente:</strong> {{ $apelacion->solicitud->docente->usuario->name }}</p>
                                <p class="mb-2"><strong>Ausencia:</strong> {{ \Illuminate\Support\Carbon::parse($apelacion->solicitud->fecha_ausencia)->locale('es')->isoFormat('dddd, DD [de] MMMM') }}</p>
                                <p><strong>Estado:</strong>
                                    @if ($apelacion->estado === \App\Enums\EstadoApelacion::Pendiente)
                                        <span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-semibold">{{ ucfirst($apelacion->estado->value) }}</span>
                                    @elseif ($apelacion->estado === \App\Enums\EstadoApelacion::Aprobada)
                                        <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-semibold">{{ ucfirst($apelacion->estado->value) }}</span>
                                    @else
                                        <span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-semibold">{{ ucfirst($apelacion->estado->value) }}</span>
                                    @endif
                                </p>
                            </a>
                        @empty
                            <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay apelaciones.') }}</p>
                        @endforelse
                    </div>
                </details>
            @endforeach
        </div>
    </div>
</x-app-layout>