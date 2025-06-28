import EstadoAsistencia from '../Enums/EstadoAsistencia';

export default class ReprogramacionFrontera {
    constructor(form, options = {}) {
        this.form = form;
        this.theme = options.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        this.form.addEventListener('submit', e => {
            if (!this.validate()) {
                e.preventDefault();
            }
        });
    }

    validate() {
        const errors = [];
        const fecha = this.form.querySelector('[name="fecha"]')?.value;
        const hora = this.form.querySelector('[name="hora"]')?.value;
        const asistencia = this.form.querySelector('[name="asistencia"]')?.value;

        if (!fecha) {
            errors.push('La fecha es obligatoria.');
        }

        if (!hora) {
            errors.push('La hora es obligatoria.');
        }

        const validAsistencia = Object.values(EstadoAsistencia);
        if (!asistencia || !validAsistencia.includes(asistencia)) {
            errors.push('Debes seleccionar un estado de asistencia válido.');
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