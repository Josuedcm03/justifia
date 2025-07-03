<x-app-layout>
    <x-slot name="header">    
        <h2 class="font-semibold text-xl text-gray-200 leading-tight">
            {{ __('Gestionar Tipos de Constancia') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white/50 dark:bg-gray-800/50 shadow sm:rounded-lg p-8">
                <div class="flex justify-end mb-4">
                    <a href="{{ route('secretaria.tipo-constancia.create') }}"
                    class="inline-flex items-center gap-2 bg-[#0099a8] hover:bg-[#007e8b] text-white px-4 py-2 rounded-md text-sm font-semibold transition">
                    <x-heroicon-o-plus class="w-5 h-5" />
                    Crear Tipo de Constancia
                    </a>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <thead>
                            <tr>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">Nombre del Tipo de Constancia</th>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-right text-xs font-medium text-white uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                            @forelse($tipos as $tipo)
                                <tr>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">{{ $tipo->nombre }}</td>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200 text-right space-x-2">
                                        <a href="{{ route('secretaria.tipo-constancia.edit', $tipo) }}" class="text-[#0099a8] hover:underline">Editar</a>
                                        <form action="{{ route('secretaria.tipo-constancia.destroy', $tipo) }}" method="POST" class="inline">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="text-red-600 hover:underline" onclick="return confirm('¿Eliminar tipo de constancia?')">Eliminar</button>
                                        </form>
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="2" class="px-6 py-4 text-center text-gray-600 dark:text-gray-400">No hay tipos de constancia.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                    <div class="mt-4">
                        {{ $tipos->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</x-app-layout>