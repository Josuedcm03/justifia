import { getCurrentTheme } from '../utils/theme';

export default class AsistenciaFrontera {
    constructor(card) {
        this.card = card;
        this.form = card.querySelector('[data-asistencia-form]');
        this.editBtn = card.querySelector('[data-asistencia-edit]');
        this.init();
    }

    init() {
        if (!this.form) return;
        if (this.editBtn) {
            this.editBtn.addEventListener('click', e => {
                e.stopPropagation();
                this.showEditModal();
            });
        } else {
            this.card.addEventListener('click', () => this.showModal());
        }
    }

    showModal() {
        Swal.fire({
            theme: getCurrentTheme(),
            title: 'Registrar asistencia',
            showDenyButton: true,
            confirmButtonColor: '#0b545b',
            denyButtonColor: '#b91c1c',
            confirmButtonText: 'Asisti\u00f3',
            denyButtonText: 'No asisti\u00f3'
        }).then(result => {
            if (result.isConfirmed || result.isDenied) {
                this.form.querySelector('[name="asistencia"]').value = result.isConfirmed ? 'asistio' : 'no_asistio';
                this.form.submit();
            }
        });
    }

    showEditModal() {
        Swal.fire({
            theme: getCurrentTheme(),
            title: 'Modificar asistencia',
            showDenyButton: true,
            confirmButtonColor: '#0b545b',
            denyButtonColor: '#b91c1c',
            confirmButtonText: 'Asisti\u00f3',
            denyButtonText: 'No asisti\u00f3'
        }).then(result => {
            if (result.isConfirmed || result.isDenied) {
                this.form.querySelector('[name="asistencia"]').value = result.isConfirmed ? 'asistio' : 'no_asistio';
                this.form.submit();
            }
        });
    }
}