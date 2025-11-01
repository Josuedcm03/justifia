import { getCurrentTheme } from '../utils/theme';
export default class SolicitudFrontera {
    constructor(form, options = {}) {
        this.form = form;
        this.isUpdate = options.isUpdate || false;
        this.oldAsignatura = form.dataset.oldAsignatura || '';
        this.buscarDocentesUrl = form.dataset.buscarDocentesUrl;
        this.buscarAsignaturasUrl = form.dataset.buscarAsignaturasUrl;
        this.docenteInput = this.form.querySelector('#docente_input');
        this.docenteHidden = this.form.querySelector('#docente_id');
        this.facultadSelect = this.form.querySelector('#facultad_id');
        this.asignaturaInput = this.form.querySelector('#asignatura_input');
        this.asignaturaHidden = this.form.querySelector('#asignatura_id');
        this.asignaturaList = this.form.querySelector('#asignatura_results');
        this.asignaturaIcon = this.form.querySelector('#asignatura_icon');
        this.asignaturaClear = this.form.querySelector('#asignatura_clear');
        this.asignaturaWrapper = this.form.querySelector('#asignatura-wrapper');
        this.asignaturaSelected = !!(this.asignaturaHidden && this.asignaturaHidden.value);
        this.constanciaInput = this.form.querySelector('#constancia');
        this.deleteConstancia = this.form.querySelector('#delete_constancia');
        this.eliminarBtn = document.getElementById('eliminar-btn');
        this.eliminarForm = document.getElementById('eliminar-form');
        this.confirmed = false;
        this.registerEvents();
        if (this.facultadSelect && this.facultadSelect.value) {
            this.cargarAsignaturas(this.facultadSelect.value, this.oldAsignatura);
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
                    theme: getCurrentTheme(),
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

        if (this.docenteInput) {
            this.docenteInput.addEventListener('input', e => {
                this.buscarDocentes(e.target.value);
            });
            this.docenteInput.addEventListener('change', e => {
                const option = Array.from(this.docenteInput.list.options).find(o => o.value === e.target.value);
                this.docenteHidden.value = option ? option.dataset.id : '';
            });
        }

        if (this.facultadSelect) {
            this.facultadSelect.addEventListener('change', () => {
                this.limpiarAsignatura();
            });
        }

        if (this.asignaturaInput) {
            this.asignaturaInput.addEventListener('input', e => {
                if (this.asignaturaSelected) return;
                this.buscarAsignaturas(e.target.value);
            });
            this.asignaturaInput.addEventListener('focus', () => {
                if (this.asignaturaSelected) return;
                if (this.asignaturaList && this.asignaturaList.children.length) {
                    this.asignaturaList.classList.remove('hidden');
                }
            });
        }

        if (this.asignaturaClear) {
            this.asignaturaClear.addEventListener('click', () => this.limpiarAsignatura());
        }

        if (this.eliminarBtn && this.eliminarForm) {
            this.eliminarBtn.addEventListener('click', () => {
                Swal.fire({
                    theme: getCurrentTheme(),
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

    buscarDocentes(query) {
        if (!this.buscarDocentesUrl) return;
        fetch(`${this.buscarDocentesUrl}?q=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(data => {
                const list = this.docenteInput.list;
                list.innerHTML = '';
                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.nombre;
                    option.dataset.id = item.id;
                    list.appendChild(option);
                });
            });
    }

    validate() {
        const errors = [];
        const fecha = this.form.querySelector('#fecha_ausencia')?.value;
        if (!fecha) {
            errors.push('La fecha de ausencia es obligatoria');
        } else {
            const selectedDate = new Date(fecha);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (selectedDate > today) {
                errors.push('La fecha de ausencia no puede ser posterior a hoy');
            }
        }

        if (this.docenteHidden && !this.docenteHidden.value) {
            errors.push('Debes seleccionar un docente');
        }

        if (this.asignaturaHidden && !this.asignaturaHidden.value) {
            errors.push('Debes seleccionar una asignatura');
        }

        const tipoConstancia = this.form.querySelector('#tipo_constancia_id');
        if (tipoConstancia && !tipoConstancia.value) {
            errors.push('Debes seleccionar un tipo de constancia');
        }

        if (this.constanciaInput) {
            const file = this.constanciaInput.files[0];
            if (!file && !this.isUpdate) {
                errors.push('Debes adjuntar una constancia.');
            } else if (file) {
                const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
                if (!allowed.includes(file.type)) {
                    errors.push('El archivo debe ser PDF o JPG');
                }
                if (file.size > 2 * 1024 * 1024) {
                    errors.push('El archivo debe pesar menos de 2 MB');
                }
            }
        }

        if (errors.length) {
            Swal.fire({
                theme: getCurrentTheme(),
                title: 'Errores de validación',
                html: `<ul class="text-center">${errors.map(e => `<li class="mb-2">${e}</li>`).join('')}</ul>`,
                icon: 'error',
                confirmButtonColor: '#0b545b'
            });
            return false;
        }
        return true;
    }
}