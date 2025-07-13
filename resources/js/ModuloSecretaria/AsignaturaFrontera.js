import { getCurrentTheme } from '../utils/theme';

export default class AsignaturaFrontera {
    constructor(form) {
        this.form = form;
        this.form.addEventListener('submit', e => {
            if (!this.validate()) {
                e.preventDefault();
            }
        });
    }

    validate() {
        const nombre = this.form.querySelector('#nombre')?.value.trim();
        const facultad = this.form.querySelector('#facultad_id')?.value;
        const errors = [];
        if (!nombre) {
            errors.push('El nombre de la asignatura es obligatorio.');
        }
        if (!facultad) {
            errors.push('Debes seleccionar una facultad.');
        }
        if (errors.length) {
            Swal.fire({
                theme: getCurrentTheme(),
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