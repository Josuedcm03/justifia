<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-[#212121] dark:text-gray-200 leading-tight">
            {{ __('Solicitudes de Justificación') }}
        </h2>
    </x-slot>


    <div class="py-12">
            <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="flex justify-end mb-4">
                <a href="{{ route('solicitudes.create') }}" class="inline-flex items-center px-4 py-2 bg-[#0099a8] hover:bg-[#007e8b] text-white text-sm font-semibold rounded-lg shadow-sm transition">
                    {{ __('Crear Solicitud') }}
                </a>
            </div>

            @if(session('success'))
                <div class="mb-4 font-medium text-sm text-green-600">
                    {{ session('success') }}
                </div>
            @endif

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @forelse ($solicitudes as $solicitud)
                    <a href="{{ route('solicitudes.show', $solicitud) }}" class="relative group block bg-white dark:bg-gray-800 border-2 border-transparent hover:border-[#0099a8] shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out">
                        <p class="mb-1"><strong>Clase:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }} - Grupo {{ $solicitud->docenteAsignatura->grupo }}</p>
                        <p class="mb-1"><strong>Fecha:</strong> {{ $solicitud->fecha_ausencia }}</p>
                        <p class="mb-2"><strong>Docente:</strong> {{ $solicitud->docenteAsignatura->docente->usuario->name }}</p>
                        <p><strong>Estado:</strong>
                            @php
                                $estadoClasses = [
                                    'pendiente' => 'bg-[#0099a8] text-white',
                                    'aprobada' => 'bg-green-100 text-green-800',
                                    'rechazada' => 'bg-red-100 text-red-800',
                                ];
                            @endphp
                            <span class="{{ $estadoClasses[$solicitud->estado] ?? 'bg-gray-200 text-gray-700' }} text-xs px-2 py-1 rounded font-semibold">
                                {{ ucfirst($solicitud->estado) }}
                            </span>
                        </p>
 </a>
                @empty
                    <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay solicitudes registradas.') }}</p>
                @endforelse
            </div>

            <div class="mt-6">
                {{ $solicitudes->links() }}
            </div>
        </div>
    </div>
</x-app-layout>