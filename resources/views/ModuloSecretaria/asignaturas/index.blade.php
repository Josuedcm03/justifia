<x-app-layout>
    <x-slot name="header">
<div class="flex justify-between items-center">
            <a href="{{ route('secretaria.catalogos.index') }}" class="flex items-center text-base text-gray-200 hover:text-[#006b75] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white/50 dark:bg-gray-800/50 shadow sm:rounded-lg p-8">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="font-semibold text-lg text-gray-800 dark:text-gray-200 ml-1">{{ __('Gestionar Asignaturas') }}</h2>
                    <div class="flex">
                        <a href="{{ route('secretaria.asignaturas.import.form') }}"
                        class="inline-flex items-center gap-2 bg-[#6E7881] hover:bg-[#4f5961] text-white px-4 py-2 rounded-md text-sm font-semibold mr-2 transition">
                        <x-heroicon-o-document-plus class="w-5 h-5" />
                        Importar Excel</a>
                        <a href="{{ route('secretaria.asignaturas.create') }}"
                        class="inline-flex items-center gap-2 bg-[#0099a8] hover:bg-[#007e8b] text-white px-4 py-2 rounded-md text-sm font-semibold transition">
                        <x-heroicon-o-plus class="w-5 h-5" />
                        Nueva Asignatura</a>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <thead>
                            <tr>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">Nombre de la Asignatura</th>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">Facultad</th>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-right text-xs font-medium text-white uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                            @forelse($asignaturas as $asignatura)
                                <tr>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">{{ $asignatura->nombre }}</td>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">{{ $asignatura->facultad->nombre }}</td>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200 text-right space-x-2">
                                        <a href="{{ route('secretaria.asignaturas.edit', $asignatura) }}" class="text-[#0099a8] hover:underline">Editar</a>
                                        <form action="{{ route('secretaria.asignaturas.destroy', $asignatura) }}" method="POST" class="inline">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="text-red-600 hover:underline" onclick="return confirm('¿Eliminar asignatura?')">Eliminar</button>
                                        </form>
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="3" class="px-6 py-4 text-center text-gray-600 dark:text-gray-400">No hay asignaturas.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
                <div class="mt-4">
                    {{ $asignaturas->links() }}
                </div>
            </div>
        </div>
    </div>
</x-app-layout>