<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-200 leading-tight">
            {{ __('Gestionar Carreras') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white/50 dark:bg-gray-800/50 shadow sm:rounded-lg p-8">
                <div class="flex justify-end mb-4">
                    <a href="{{ route('secretaria.carreras.create') }}"
                    class="inline-flex items-center gap-2 bg-[#0099a8] hover:bg-[#007e8b] text-white px-4 py-2 rounded-md text-sm font-semibold transition">
                    <x-heroicon-o-plus class="w-5 h-5" />
                    Nueva Carrera</a>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <thead>
                            <tr>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">Nombre de la Carrera</th>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">Facultad</th>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-right text-xs font-medium text-white uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                            @forelse($carreras as $carrera)
                                <tr>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">{{ $carrera->nombre }}</td>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">{{ $carrera->facultad->nombre }}</td>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200 text-right space-x-2">
                                        <a href="{{ route('secretaria.carreras.edit', $carrera) }}" class="text-[#0099a8] hover:underline">Editar</a>
                                        <form action="{{ route('secretaria.carreras.destroy', $carrera) }}" method="POST" class="inline">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="text-red-600 hover:underline" onclick="return confirm('¿Eliminar carrera?')">Eliminar</button>
                                        </form>
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="3" class="px-6 py-4 text-center text-gray-600 dark:text-gray-400">No hay carreras.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
                <div class="mt-4">
                    {{ $carreras->links() }}
                </div>
            </div>
        </div>
    </div>
</x-app-layout>