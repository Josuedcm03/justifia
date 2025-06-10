<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">
            {{ __('Crear Solicitud') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-4xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg p-6">
                <form method="POST" action="{{ route('solicitudes.store') }}" enctype="multipart/form-data">
                    @csrf
                    <div class="mb-4">
                        <x-input-label for="fecha_ausencia" value="Fecha de ausencia" />
                        <x-text-input type="date" name="fecha_ausencia" id="fecha_ausencia" class="mt-1 block w-full" value="{{ old('fecha_ausencia') }}" required />
                        <x-input-error class="mt-2" :messages="$errors->get('fecha_ausencia')" />
                    </div>

                    <div class="mb-4">
                        <x-input-label for="docente_id" value="Docente" />
                        <select id="docente_id" name="docente_id" class="mt-1 block w-full">
                            <option value="">Seleccione un docente</option>
                            @foreach ($docentes as $docente)
                                <option value="{{ $docente->id }}" @selected(old('docente_id') == $docente->id)>
                                    {{ $docente->usuario->name }}
                                </option>
                            @endforeach
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('docente_id')" />
                    </div>

                    <div class="mb-4">
                        <x-input-label for="docente_asignatura_id" value="Asignatura y Grupo" />
                        <select id="docente_asignatura_id" name="docente_asignatura_id" class="mt-1 block w-full">
                            <option value="">Seleccione una asignatura</option>
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('docente_asignatura_id')" />
                    </div>

                    <div class="mb-4">
                        <x-input-label for="tipo_constancia_id" value="Tipo de constancia" />
                        <select id="tipo_constancia_id" name="tipo_constancia_id" class="mt-1 block w-full">
                            <option value="">Seleccione una opción</option>
                            @foreach ($tiposConstancia as $tipo)
                                <option value="{{ $tipo->id }}" @selected(old('tipo_constancia_id') == $tipo->id)>
                                    {{ $tipo->nombre }}
                                </option>
                            @endforeach
                        </select>
                        <x-input-error class="mt-2" :messages="$errors->get('tipo_constancia_id')" />
                    </div>

                    <div class="mb-4">
                        <x-input-label for="constancia" value="Archivo de constancia" />
                        <input id="constancia" name="constancia" type="file" class="mt-1 block w-full" accept=".jpg,.jpeg,.pdf" />
                        <x-input-error class="mt-2" :messages="$errors->get('constancia')" />
                    </div>

                    <div class="mb-4">
                        <x-input-label for="observaciones" value="Observaciones" />
                        <textarea id="observaciones" name="observaciones" rows="3" class="mt-1 block w-full">{{ old('observaciones') }}</textarea>
                        <x-input-error class="mt-2" :messages="$errors->get('observaciones')" />
                    </div>

                    <div class="flex justify-end">
                        <x-primary-button>{{ __('Guardar') }}</x-primary-button>
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
                    asignaturaSelect.innerHTML = '<option value="">Seleccione una asignatura</option>';
                    return;
                }
                fetch(`{{ url('docentes') }}/${docenteId}/asignaturas`)
                    .then(r => r.json())
                    .then(data => {
                        asignaturaSelect.innerHTML = '<option value="">Seleccione una asignatura</option>';
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