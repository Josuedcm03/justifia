<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-[#212121] dark:text-gray-200 leading-tight">
            {{ __('Solicitudes Aprobadas') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @forelse($solicitudes as $solicitud)
                    <a href="{{ route('docente.solicitudes.show', $solicitud) }}" class="bg-white dark:bg-gray-800 shadow rounded-lg p-5 text-[#212121] dark:text-white hover:shadow-md transform hover:scale-105 transition-all duration-150 ease-in-out">
                        <p class="mb-1"><strong>Estudiante:</strong> {{ $solicitud->estudiante->usuario->name }}</p>
                        <p class="mb-1"><strong>Asignatura:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }} - Grupo {{ $solicitud->docenteAsignatura->grupo }}</p>
                        <p class="mb-1"><strong>Fecha ausencia:</strong> {{ $solicitud->fecha_ausencia }}</p>
                        @if($solicitud->reprogramacion)
                            <span class="text-sm text-green-600">Reprogramada</span>
                        @else
                            <span class="text-sm text-yellow-600">Pendiente</span>
                        @endif
                    </a>
                @empty
                    <p class="col-span-full text-gray-600 dark:text-gray-400">{{ __('No hay solicitudes.') }}</p>
                @endforelse
            </div>
        </div>
    </div>
</x-app-layout>