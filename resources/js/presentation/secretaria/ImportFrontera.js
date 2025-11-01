import { getCurrentTheme } from '../utils/theme';

export default class ImportFrontera {
    constructor(form) {
        this.form = form;
        this.form.addEventListener('submit', e => {
            if (!this.validate()) {
                e.preventDefault();
            }
        });
    }

    validate() {
        const fileInput = this.form.querySelector('input[type="file"]');
        const file = fileInput?.files[0];
        const errors = [];
        if (!file) {
            errors.push('Debes seleccionar un archivo.');
        } else if (!file.name.endsWith('.xlsx')) {
            errors.push('El archivo debe ser .xlsx');
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