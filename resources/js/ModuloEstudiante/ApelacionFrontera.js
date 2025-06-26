export default class ApelacionFrontera {
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
        const obs = this.form.querySelector('#observacion_estudiante')?.value.trim();
        const errors = [];
        if (!obs) {
            errors.push('La observación es obligatoria.');
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