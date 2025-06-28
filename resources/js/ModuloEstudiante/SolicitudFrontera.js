export default class SolicitudFrontera {
    constructor(form, options = {}) {
        this.form = form;
        this.isUpdate = options.isUpdate || false;
        this.oldAsignatura = form.dataset.oldAsignatura || '';
        this.asignaturasUrl = form.dataset.asignaturasUrl;
        this.theme = options.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        this.docenteSelect = this.form.querySelector('#docente_id');
        this.asignaturaSelect = this.form.querySelector('#docente_asignatura_id');
        this.constanciaInput = this.form.querySelector('#constancia');
        this.deleteConstancia = this.form.querySelector('#delete_constancia');
        this.eliminarBtn = document.getElementById('eliminar-btn');
        this.eliminarForm = document.getElementById('eliminar-form');
        this.confirmed = false;
        this.registerEvents();
        if (this.docenteSelect && this.docenteSelect.value) {
            this.cargarAsignaturas(this.docenteSelect.value, this.oldAsignatura);
        }
    }

    registerEvents() {
        this.form.addEventListener('submit', e => {
            if (!this.validate()) {
                e.preventDefault();
                return;
            }

            if (this.isUpdate && !this.confirmed) {
                e.preventDefault();
                Swal.fire({
                    theme: this.theme,
                    title: '¿Guardar cambios?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#0b545b',
                    confirmButtonText: 'Sí, guardar',
                    cancelButtonText: 'Cancelar'
                }).then(result => {
                    if (result.isConfirmed) {
                        this.confirmed = true;
                        this.form.submit();
                    }
                });
            }
        });

        if (this.docenteSelect) {
            this.docenteSelect.addEventListener('change', e => {
                this.cargarAsignaturas(e.target.value);
            });
        }

        if (this.eliminarBtn && this.eliminarForm) {
            this.eliminarBtn.addEventListener('click', () => {
                Swal.fire({
                    theme: this.theme,
                    title: '¿Deseas Eliminar la Solicitud?',
                    text: 'Esta acción no se puede deshacer',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#0b545b',
                    confirmButtonText: 'Sí, eliminar',
                    cancelButtonText: 'Cancelar'
                }).then(result => {
                    if (result.isConfirmed) {
                        this.eliminarForm.submit();
                    }
                });
            });
        }
    }

    cargarAsignaturas(docenteId, selected = null) {
        if (!this.asignaturaSelect) return;
        this.asignaturaSelect.innerHTML = '<option value="">Cargando...</option>';
        if (!docenteId) {
            this.asignaturaSelect.innerHTML = '<option value="">Seleccionar Asignatura</option>';
            return;
        }
        fetch(`${this.asignaturasUrl}/${docenteId}/asignaturas`)
            .then(r => r.json())
            .then(data => {
                this.asignaturaSelect.innerHTML = '<option value="">Seleccionar Asignatura</option>';
                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = item.nombre;
                    if (selected == item.id) {
                        option.selected = true;
                    }
                    this.asignaturaSelect.appendChild(option);
                });
            });
    }

    validate() {
        const errors = [];
        const fecha = this.form.querySelector('#fecha_ausencia')?.value;
        if (!fecha) {
            errors.push('La fecha de ausencia es obligatoria.');
        } else {
            const selectedDate = new Date(fecha);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (selectedDate > today) {
                errors.push('La fecha de ausencia no puede ser posterior a hoy.');
            }
        }

        if (this.docenteSelect && !this.docenteSelect.value) {
            errors.push('Debes seleccionar un docente.');
        }

        if (this.asignaturaSelect && !this.asignaturaSelect.value) {
            errors.push('Debes seleccionar una asignatura.');
        }

        const tipoConstancia = this.form.querySelector('#tipo_constancia_id');
        if (tipoConstancia && !tipoConstancia.value) {
            errors.push('Debes seleccionar un tipo de constancia.');
        }

        if (this.constanciaInput) {
            const file = this.constanciaInput.files[0];
            if (!file && !this.isUpdate) {
                errors.push('Debes adjuntar una constancia.');
            } else if (file) {
                const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
                if (!allowed.includes(file.type)) {
                    errors.push('El archivo debe ser PDF o JPG.');
                }
                if (file.size > 2 * 1024 * 1024) {
                    errors.push('El archivo debe pesar menos de 2 MB.');
                }
            }
        }

        if (errors.length) {
            Swal.fire({
                theme: this.theme,
                title: 'Errores de validación',
                html: `<ul class="text-center">${errors.map(e => `<li>${e}</li>`).join('')}</ul>`,
                icon: 'error',
                confirmButtonColor: '#0b545b'
            });
            return false;
        }
        return true;
    }
}