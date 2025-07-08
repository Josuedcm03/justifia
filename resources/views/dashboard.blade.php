<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-200 leading-tight">
            {{ __('Dashboard') }}
        </h2>
    </x-slot>

    <div class="py-12" id="dashboard-charts">
        @if(auth()->user()->hasRole('secretaria'))
            <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
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
