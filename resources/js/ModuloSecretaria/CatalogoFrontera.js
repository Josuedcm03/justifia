import { getCurrentTheme } from '../utils/theme';

export default class CatalogoFrontera {
    constructor(container) {
        this.container = container;
        this.registerDeleteConfirmation();
    }

    registerDeleteConfirmation() {
        this.container.querySelectorAll('[data-delete-form]').forEach(form => {
            form.addEventListener('submit', e => {
                e.preventDefault();
                const message = form.dataset.message || '¿Eliminar este registro?';
                Swal.fire({
                    theme: getCurrentTheme(),
                    title: message,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#6b7280',
                    confirmButtonText: 'Sí',
                    cancelButtonText: 'No'
                }).then(result => {
                    if (result.isConfirmed) {
                        form.submit();
                    }
                });
            });
        });
    }
}