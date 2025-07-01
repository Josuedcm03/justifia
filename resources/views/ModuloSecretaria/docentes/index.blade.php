<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-200 leading-tight">
            {{ __('Gestionar Docentes') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8">
                <div class="flex justify-end mb-4">
                    <a href="{{ route('secretaria.docentes.import') }}" class="bg-[#6E7881] hover:bg-[#4f5961] text-white px-4 py-2 rounded-md text-sm font-semibold mr-2">Importar Excel</a>
                    <a href="{{ route('secretaria.docentes.create') }}" class="bg-[#0099a8] hover:bg-[#007e8b] text-white px-4 py-2 rounded-md text-sm font-semibold">Nuevo Docente</a>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <thead>
                            <tr>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">CIF</th>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">Nombre</th>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">Correo</th>
                                <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-right text-xs font-medium text-white uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                            @forelse($docentes as $docente)
                                <tr>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">{{ $docente->cif }}</td>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">{{ $docente->usuario?->name }}</td>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">{{ $docente->usuario?->email }}</td>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200 text-right space-x-2">
                                        <a href="{{ route('secretaria.docentes.edit', $docente) }}" class="text-[#0099a8] hover:underline">Editar</a>
                                        <form action="{{ route('secretaria.docentes.destroy', $docente) }}" method="POST" class="inline">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="text-red-600 hover:underline" onclick="return confirm('¿Eliminar docente?')">Eliminar</button>
                                        </form>
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="4" class="px-6 py-4 text-center text-gray-600 dark:text-gray-400">No hay docentes.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
                <div class="mt-4">
                    {{ $docentes->links() }}
                </div>
            </div>
        </div>
    </div>
</x-app-layout>