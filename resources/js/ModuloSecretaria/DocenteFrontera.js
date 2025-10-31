import { getCurrentTheme } from '../utils/theme';

export default class DocenteFrontera {
    constructor(form) {
        this.form = form;
        this.form.addEventListener('submit', e => {
            if (!this.validate()) {
                e.preventDefault();
            }
        });
    }

    validate() {
        const cif = this.form.querySelector('#cif')?.value.trim();
        const name = this.form.querySelector('#name')?.value.trim();
        const email = this.form.querySelector('#email')?.value.trim();
        const errors = [];
        if (!cif) {
            errors.push('El CIF es obligatorio.');
        }
        if (!name) {
            errors.push('El nombre del docente es obligatorio.');
        }
        if (!email) {
            errors.push('El correo electrónico es obligatorio.');
        } else if (!/^\S+@\S+\.\S+$/.test(email)) {
            errors.push('El correo electrónico no es válido.');
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