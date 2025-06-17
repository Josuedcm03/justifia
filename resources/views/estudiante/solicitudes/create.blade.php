<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <a href="{{ route('estudiante.solicitudes.index') }}" class="flex items-center text-sm text-[#0099a8] hover:text-[#007e8b] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
            <h2 class="font-semibold text-xl text-[#212121] dark:text-gray-200 leading-tight">
                {{ __('Crear Solicitud') }}
            </h2>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8 text-[#212121] dark:text-white space-y-6">
                <h3 class="text-2xl font-bold mb-4 text-[#0099a8] dark:text-[#40c4d0]">
                    Formulario de Justificación
                </h3>

                <form method="POST" action="{{ route('estudiante.solicitudes.store') }}" enctype="multipart/form-data" class="space-y-4">
                    @csrf
                    <div>
                        <label for="fecha_ausencia" class="block font-medium mb-1">Fecha de la ausencia</label>
                        <input type="date" name="fecha_ausencia" id="fecha_ausencia" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]" value="{{ old('fecha_ausencia') }}" required>
                        <x-input-error class="mt-2" :messages="$errors->get('fecha_ausencia')" />
                    </div>

                    <div>
                        <label for="docente_id" class="block font-medium mb-1">Docente</label>
<select id="docente_id" name="docente_id" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                            <option value="">Seleccionar Docente</option>
                            @foreach ($docentes as $docente)
                                <option value="{{ $docente->id }}" @selected(old('docente_id') == $docente->id)>
                                    {{ $docente->usuario->name }}
                                </option>
                            @endforeach
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('docente_id')" />
                    </div>

                    <div>
 <label for="docente_asignatura_id" class="block font-medium mb-1">Asignatura</label>
                        <select id="docente_asignatura_id" name="docente_asignatura_id" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                            <option value="">Seleccionar Asignatura</option>
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('docente_asignatura_id')" />
                    </div>

                    <div>
                                                <label for="tipo_constancia_id" class="block font-medium mb-1">Tipo de constancia</label>
                        <select id="tipo_constancia_id" name="tipo_constancia_id" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8]">
                            <option value="">Seleccionar Tipo de Constancia</option>
                            @foreach ($TiposConstancia as $tipo)
                                <option value="{{ $tipo->id }}" @selected(old('tipo_constancia_id') == $tipo->id)>
                                    {{ $tipo->nombre }}
                                </option>
                            @endforeach
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('tipo_constancia_id')" />
                    </div>

                    <div>
                      <label for="constancia" class="block font-medium mb-1">Cargar constancia (PDF, JPG, JPEG)</label>
                        <input id="constancia" name="constancia" type="file" accept=".pdf,.jpg,.jpeg,.png" class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white">
                        <x-input-error class="mt-2" :messages="$errors->get('constancia')" />
                    </div>

                    <div>
                       <label for="observaciones" class="block font-medium mb-1">Notas adicionales</label>
                        <textarea id="observaciones" name="observaciones" rows="3" placeholder="Información complementaria..." class="w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-700 dark:text-white focus:ring-[#0099a8] focus:border-[#0099a8] resize-y">{{ old('observaciones') }}</textarea>
                        <x-input-error class="mt-2" :messages="$errors->get('observaciones')" />
                    </div>

                    <div class="flex justify-end pt-4">
                        <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] transition font-semibold">
                            {{ __('Enviar Solicitud') }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const docenteSelect = document.getElementById('docente_id');
            const asignaturaSelect = document.getElementById('docente_asignatura_id');

            function cargarAsignaturas(docenteId) {
                asignaturaSelect.innerHTML = '<option value="">Cargando...</option>';
                if (!docenteId) {
                    asignaturaSelect.innerHTML = '<option value="">Seleccionar Asignatura</option>';
                    return;
                }
                fetch(`{{ url('estudiante/docentes') }}/${docenteId}/asignaturas`)
                    .then(r => r.json())
                    .then(data => {
                        asignaturaSelect.innerHTML = '<option value="">Seleccionar Asignatura</option>';
                        data.forEach(item => {
                            const option = document.createElement('option');
                            option.value = item.id;
                            option.textContent = item.nombre;
                            if ('{{ old('docente_asignatura_id') }}' == item.id) {
                                option.selected = true;
                            }
                            asignaturaSelect.appendChild(option);
                        });
                    });
            }

            docenteSelect.addEventListener('change', (e) => {
                cargarAsignaturas(e.target.value);
            });

            if (docenteSelect.value) {
                cargarAsignaturas(docenteSelect.value);
            }
        });
    </script>
</x-app-layout>