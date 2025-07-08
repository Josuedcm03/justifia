<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-200 leading-tight">
            {{ __('Dashboard') }}
        </h2>
    </x-slot>

    <div class="py-12" id="dashboard-charts">
        @if(auth()->user()->hasRole('secretaria'))
            <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6" x-data="{open:false}">
                <div class="flex justify-end">
                    <div class="relative" >
                        <button @click="open = !open" class="bg-[#0099a8] text-white px-4 py-2 rounded-lg shadow">Generar Reporte PDF</button>
                        <div x-show="open" x-transition @click.away="open=false" class="absolute right-0 mt-2 bg-white dark:bg-gray-800 p-4 rounded shadow text-black dark:text-white z-10">
                            <form method="GET" action="{{ route('secretaria.solicitudes.pdf') }}" class="space-y-2">
                                <select name="solicitud_id" class="block w-56 text-sm text-black rounded border-gray-300">
                                    <option value="" selected disabled>Seleccione solicitud</option>
                                    @foreach($solicitudesListado as $s)
                                        <option value="{{ $s->id }}">#{{ $s->id }} - {{ $s->estudiante->usuario->name }}</option>
                                    @endforeach
                                </select>
                                <button type="submit" class="bg-[#0099a8] text-white px-3 py-1 rounded">Descargar</button>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <canvas id="chart-solicitudes" class="h-64"></canvas>
                    </div>
                    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <canvas id="chart-apelaciones" class="h-64"></canvas>
                    </div>
                </div>
                <div class="grid grid-cols-1 gap-6">
                    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <canvas id="chart-carreras" class="h-72"></canvas>
                    </div>
                    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <canvas id="chart-facultades" class="h-72"></canvas>
                    </div>
                </div>
            </div>
        @else
            <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
                <div class="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                    <div class="p-6 text-gray-900 dark:text-gray-100">
                        {{ __("You're logged in!") }}
                    </div>
                </div>
            </div>
        @endif
    </div>
</x-app-layout>
