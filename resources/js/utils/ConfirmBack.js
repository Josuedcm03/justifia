import { getCurrentTheme } from './theme';

export default class ConfirmBackFrontera {
    constructor(element, options = {}) {
        this.element = element;
        this.message = options.message || '¿Está seguro de salir de esta vista? Se perderá todo lo importado y modificado.';
        this.register();
    }

    register() {
        this.element.addEventListener('click', e => {
            e.preventDefault();
            Swal.fire({
                theme: getCurrentTheme(),
                title: this.message,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#0b545b',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Sí',
                cancelButtonText: 'No'
            }).then(result => {
                if (result.isConfirmed) {
                    window.location.href = this.element.href;
                }
            });
        });
    }
}