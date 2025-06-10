<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">
            {{ __('Solicitudes') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="flex justify-end mb-4">
                <a href="{{ route('solicitudes.create') }}" class="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500">
                    {{ __('Nueva Solicitud') }}
                </a>
            </div>

            @if(session('success'))
                <div class="mb-4 font-medium text-sm text-green-600">
                    {{ session('success') }}
                </div>
            @endif

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @forelse ($solicitudes as $solicitud)
                    <div class="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            {{ $solicitud->docenteAsignatura->asignatura->nombre }} - Grupo {{ $solicitud->docenteAsignatura->grupo }}
                        </h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            {{ __('Docente:') }} {{ $solicitud->docenteAsignatura->docente->usuario->name }}
                        </p>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            {{ __('Fecha de ausencia:') }} {{ $solicitud->fecha_ausencia}}
                        </p>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            {{ __('Estado:') }} {{ ucfirst($solicitud->estado) }}
                        </p>
                        <div class="mt-4">
                            <a href="{{ route('solicitudes.show', $solicitud) }}" class="text-indigo-600 hover:text-indigo-900">
                                {{ __('Ver') }}
                            </a>
                        </div>
                    </div>
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