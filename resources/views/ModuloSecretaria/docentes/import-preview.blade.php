<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('secretaria.docentes.import.form') }}"
                data-confirm-back
                class="flex items-center text-base text-gray-200 hover:text-[#006b75] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white/50 dark:bg-gray-800/50 shadow sm:rounded-lg p-8">
                <form method="POST" action="{{ route('secretaria.docentes.import') }}">
                    @csrf
                    <div class="overflow-x-auto">
                        <table class="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <thead>
                                <tr>
                                    <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">CIF</th>
                                    <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">Nombre</th>
                                    <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-left text-xs font-medium text-white uppercase tracking-wider">Email</th>
                                    <th class="px-6 py-3 border-b bg-[#0099a8] dark:bg-[#007e8b] text-right text-xs font-medium text-white uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="rows" class="divide-y divide-gray-200 dark:divide-gray-700">
                                @foreach($rows as $index => $row)
                                    <tr>
                                        <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">
                                            <input type="hidden" name="rows[{{ $index }}][cif]" value="{{ $row['cif'] }}" class="hidden-cif">
                                            <div class="flex items-center gap-2">
                                                <span class="display-cif flex-1">{{ $row['cif'] }}</span>
                                                <input type="text" class="input-cif hidden flex-1 border-gray-300 rounded-md" value="{{ $row['cif'] }}">
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">
                                            <input type="hidden" name="rows[{{ $index }}][name]" value="{{ $row['name'] }}" class="hidden-name">
                                            <div class="flex items-center gap-2">
                                                <span class="display-name flex-1">{{ $row['name'] }}</span>
                                                <input type="text" class="input-name hidden flex-1 border-gray-300 rounded-md" value="{{ $row['name'] }}">
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">
                                            <input type="hidden" name="rows[{{ $index }}][email]" value="{{ $row['email'] }}" class="hidden-email">
                                            <div class="flex items-center gap-2">
                                                <span class="display-email flex-1">{{ $row['email'] }}</span>
                                                <input type="text" class="input-email hidden flex-1 border-gray-300 rounded-md" value="{{ $row['email'] }}">
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-200 text-right">
                                            <button type="button" onclick="editRow(this)" class="edit-row-btn text-blue-600 hover:underline mr-2">Editar</button>
                                            <button type="button" onclick="confirmRow(this)" class="confirm-row-btn hidden text-green-600 mr-2">
                                                <x-heroicon-o-check class="w-5 h-5" />
                                            </button>
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
        function editRow(button) {
            const row = button.closest('tr');
            row.querySelectorAll('[class^="display-"]').forEach(el => el.classList.add('hidden'));
            row.querySelectorAll('[class^="input-"]').forEach(el => el.classList.remove('hidden'));
            row.querySelector('.confirm-row-btn').classList.remove('hidden');
            button.classList.add('hidden');
            row.querySelector('.input-cif').focus();
        }

        function confirmRow(button) {
            const row = button.closest('tr');
            ['cif', 'name', 'email'].forEach(field => {
                const input = row.querySelector(`.input-${field}`);
                const value = input.value.trim();
                if (value !== '') {
                    row.querySelector(`input[name$="[${field}]"]`).value = value;
                    row.querySelector(`.display-${field}`).textContent = value;
                }
            });
            row.querySelectorAll('[class^="display-"]').forEach(el => el.classList.remove('hidden'));
            row.querySelectorAll('[class^="input-"]').forEach(el => el.classList.add('hidden'));
            row.querySelector('.confirm-row-btn').classList.add('hidden');
            row.querySelector('.edit-row-btn').classList.remove('hidden');
        }
    </script>
</x-app-layout>