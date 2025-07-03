import { getCurrentTheme } from '../utils/theme';

export default class ReprogramacionFrontera {
    constructor(form) {
        this.form = form;
        this.form.addEventListener('submit', e => {
            e.preventDefault();
            if (this.validate()) {
                this.confirmSubmit();
            }
        });
    }

    validate() {
        const errors = [];
        const fecha = this.form.querySelector('[name="fecha"]')?.value;
        const hora = this.form.querySelector('[name="hora"]')?.value;

        if (!fecha) {
            errors.push('La fecha es obligatoria.');
        }

        if (!hora) {
            errors.push('La hora es obligatoria.');
        }

        if (fecha && hora) {
            const selected = new Date(`${fecha}T${hora}`);
            const now = new Date();
            if (selected < now) {
                errors.push('La fecha y hora deben ser posteriores a la actual.');
            }
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

    confirmSubmit() {
        Swal.fire({
            theme: getCurrentTheme(),
            title: '¿Confirmar reprogramación?',
            iconHtml: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[#0b545b]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
            showCancelButton: true,
            confirmButtonColor: '#0b545b',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Aceptar',
            cancelButtonText: 'Cancelar'
        }).then(result => {
            if (result.isConfirmed) {
                this.form.submit();
            }
        });
    }
}