import { getCurrentTheme } from '../utils/theme';

export default class FacultadFrontera {
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
        if (!nombre) {
            Swal.fire({
                theme: getCurrentTheme(),
                title: 'Errores de validación',
                html: '<ul class="text-center"><li>El nombre de la facultad es obligatorio.</li></ul>',
                icon: 'error',
                confirmButtonColor: '#0b545b'
            });
            return false;
        }
        return true;
    }
}