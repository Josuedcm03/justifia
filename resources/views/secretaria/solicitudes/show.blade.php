<x-app-layout>
    <x-slot name="header">
        <div class="flex justify-between items-center">
            <h2 class="font-semibold text-xl text-[#212121] dark:text-gray-200 leading-tight">
            {{ $solicitud->estado === 'pendiente' ? __('Resolver Solicitud') : __('Detalle de la Solicitud') }}
            </h2>
            <a href="{{ route('secretaria.solicitudes.index') }}" class="flex items-center text-sm text-[#0099a8] hover:text-[#007e8b] transition">
                <x-heroicon-o-arrow-left class="w-5 h-5 mr-1" />
                {{ __('Volver') }}
            </a>
        </div>
    </x-slot>

    <div class="py-12">
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-8 text-[#212121] dark:text-white space-y-4">
                <h3 class="text-2xl font-bold mb-4 text-[#0099a8] dark:text-[#40c4d0]">{{ __('Detalles de la Solicitud') }}</h3>

                <p><strong>Estudiante:</strong> {{ $solicitud->estudiante->usuario->name }} ({{ $solicitud->estudiante->cif }})</p>
                <p><strong>Asignatura:</strong> {{ $solicitud->docenteAsignatura->asignatura->nombre }}</p>
                <p><strong>Grupo:</strong> {{ $solicitud->docenteAsignatura->grupo }}</p>
                <p><strong>Docente:</strong> {{ $solicitud->docenteAsignatura->docente->usuario->name }}</p>
                <p><strong>Fecha de ausencia:</strong> {{ $solicitud->fecha_ausencia }}</p>
                <p><strong>Tipo de constancia:</strong> {{ $solicitud->tipoConstancia->nombre }}</p>
                <p><strong>Observaciones:</strong> {{ $solicitud->observaciones ?? '-' }}</p>
                @if ($solicitud->respuesta)
                    <p><strong>Respuesta:</strong> {{ $solicitud->respuesta }}</p>
                @endif
                <div class="space-y-2">
                    <label class="block font-medium">Constancia adjunta</label>
                    @php $ext = strtolower(pathinfo($solicitud->constancia, PATHINFO_EXTENSION)); @endphp
                    @if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp']))
                        <img src="{{ Storage::url($solicitud->constancia) }}" alt="Constancia" class="max-h-40 rounded">
                    @elseif ($ext === 'pdf')
                        <iframe src="{{ Storage::url($solicitud->constancia) }}" class="w-full h-64"></iframe>
                    @else
                        <a href="{{ Storage::url($solicitud->constancia) }}" target="_blank" class="text-[#0099a8] underline">Abrir archivo</a>
                    @endif
                </div>

                @if ($solicitud->estado === 'pendiente')
                    <div class="flex justify-end gap-2 pt-4">
                        <form method="POST" action="{{ route('secretaria.solicitudes.update', $solicitud) }}" id="aprobar-form">
                            @csrf
                            @method('PATCH')
                            <input type="hidden" name="estado" value="aprobada">
                            <button class="bg-[#0099a8] text-white px-6 py-2 rounded-md shadow hover:bg-[#007e8b] transition font-semibold">
                                {{ __('Aprobar') }}
                            </button>
                        </form>
                        <form method="POST" action="{{ route('secretaria.solicitudes.update', $solicitud) }}" id="rechazar-form">
                            @csrf
                            @method('PATCH')
                            <input type="hidden" name="estado" value="rechazada">
                            <input type="hidden" name="respuesta" id="respuesta-input">
                            <button type="button" id="rechazar-btn" class="bg-[#0b545b] text-white px-6 py-2 rounded-md shadow hover:bg-[#094b51] transition font-semibold">
                                {{ __('Rechazar') }}
                            </button>
                        </form>
                    </div>
                @endif
            </div>
        </div>
    </div>
    @if ($solicitud->estado === 'pendiente')
        <script>
            document.getElementById('rechazar-btn').addEventListener('click', () => {
                Swal.fire({
                    theme: 'auto',
                    title: 'Rechazar solicitud',
                    input: 'textarea',
                    inputLabel: 'Respuesta',
                    inputPlaceholder: 'Escribe el motivo del rechazo',
                    showCancelButton: true,
                    confirmButtonColor: '#0b545b',
                    cancelButtonText: 'Cancelar',
                    confirmButtonText: 'Rechazar'
                }).then(result => {
                    if (result.isConfirmed && result.value) {
                        document.getElementById('respuesta-input').value = result.value;
                        document.getElementById('rechazar-form').submit();
                    }
                });
            });
        </script>
    @endif
</x-app-layout>