import { getCurrentTheme } from '../utils/theme';

export default class TipoConstanciaFrontera {
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
        const errors = [];
        if (!nombre) {
            errors.push('El nombre del tipo de constancia es obligatorio.');
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