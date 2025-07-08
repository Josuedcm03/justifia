<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('secretaria.asignaturas.import.form') }}"
                onclick="return confirm('¿Está seguro de salir de esta vista? Se perderá todo lo importado y modificado.')"
                class="flex items-center text-base text-gray-200 hover:text-[#006b75] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white/50 dark:bg-gray-800/50 shadow sm:rounded-lg p-8">
                <form method="POST" action="{{ route('secretaria.asignaturas.import') }}">
                    @csrf
                    <div class="overflow-x-auto">
                        <table class="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <thead>
                                <tr>
                                    <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">Nombre</th>
                                    <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">Facultad</th>
                                    <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-right text-xs font-medium text-white uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="rows" class="divide-y divide-gray-200 dark:divide-gray-700">
                                @foreach($rows as $index => $row)
                                    <tr>
                                        <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">
                                            <input type="hidden" name="rows[{{ $index }}][nombre]" value="{{ $row['nombre'] }}">
                                            <span class="display-nombre">{{ $row['nombre'] }}</span>
                                        </td>
                                        <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">
                                            <select name="rows[{{ $index }}][facultad_id]" class="border-gray-300 rounded-md w-full">
                                                @foreach($facultades as $facultad)
                                                    <option value="{{ $facultad->id }}">{{ $facultad->nombre }}</option>
                                                @endforeach
                                            </select>
                                        </td>
                                        <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200 text-right">
                                            <button type="button" onclick="editNombre(this)" class="text-blue-600 hover:underline mr-2">Editar</button>
                                            <button type="button" onclick="this.closest('tr').remove();" class="text-red-600 hover:underline">Eliminar</button>
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                    <div class="flex justify-end mt-4">
                        <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] font-semibold transition">Cargar</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    <script>
        function editNombre(button) {
            const row = button.closest('tr');
            const input = row.querySelector('input[name$="[nombre]"]');
            const span = row.querySelector('.display-nombre');
            const nuevo = prompt('Editar nombre de la asignatura', input.value);
            if (nuevo !== null && nuevo.trim() !== '') {
                input.value = nuevo.trim();
                span.textContent = nuevo.trim();
            }
        }
    </script>
</x-app-layout>