<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-200 leading-tight">
            {{ __('Gestionar Catálogos') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                @php
                    $catalogos = [
                        ['label' => 'Tipos de Constancia', 'route' => 'secretaria.tipo-constancia.index', 'icon' => 'document-text'],
                        ['label' => 'Facultades', 'route' => 'secretaria.facultades.index', 'icon' => 'building-library'],
                        ['label' => 'Docentes', 'route' => 'secretaria.docentes.index', 'icon' => 'users'],
                        ['label' => 'Carreras', 'route' => 'secretaria.carreras.index', 'icon' => 'academic-cap'],
                        ['label' => 'Asignaturas', 'route' => 'secretaria.asignaturas.index', 'icon' => 'book-open'],
                    ];
                @endphp

                @foreach($catalogos as $cat)
                    <a href="{{ route($cat['route']) }}" class="block bg-white dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-md transition border border-transparent hover:border-[#0099a8] group">
                        <div class="flex items-center space-x-4">
                            <x-dynamic-component :component="'heroicon-o-' . $cat['icon']" class="w-6 h-6 text-[#0099a8] group-hover:text-[#007e8b]" />
                            <span class="text-lg font-semibold text-gray-800 dark:text-white group-hover:text-[#007e8b]">{{ __($cat['label']) }}</span>
                        </div>
                    </a>
                @endforeach
            </div>
        </div>
    </div>
</x-app-layout>