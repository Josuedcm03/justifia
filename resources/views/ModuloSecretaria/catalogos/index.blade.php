<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-200 leading-tight">
            {{ __('Catálogos') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8 space-y-2">
                <a href="{{ route('secretaria.tipo-constancia.index') }}" class="text-[#0099a8] hover:underline">{{ __('Tipos de constancia') }}</a>
                <a href="{{ route('secretaria.facultades.index') }}" class="text-[#0099a8] hover:underline">{{ __('Facultades') }}</a>
                <a href="{{ route('secretaria.docentes.index') }}" class="text-[#0099a8] hover:underline">{{ __('Docentes') }}</a>
                <a href="{{ route('secretaria.carreras.index') }}" class="text-[#0099a8] hover:underline">{{ __('Carreras') }}</a>
                <a href="{{ route('secretaria.asignaturas.index') }}" class="text-[#0099a8] hover:underline">{{ __('Asignaturas') }}</a>
            </div>
        </div>
    </div>
</x-app-layout>