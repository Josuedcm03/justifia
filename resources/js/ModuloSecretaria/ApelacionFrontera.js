import { getCurrentTheme } from '../utils/theme';

export default class ApelacionFrontera {
    constructor(container) {
        this.container = container;
        this.rechazarBtn = container.querySelector('#rechazar-btn');
        this.rechazarForm = container.querySelector('#rechazar-form');
        this.respuestaInput = container.querySelector('#respuesta-input');
        this.aprobarForm = container.querySelector('#aprobar-form');
        this.aprobarInput = container.querySelector('#respuesta-aprobar');
        this.registerEvents();
    }

    registerEvents() {
        if (this.rechazarBtn && this.rechazarForm && this.respuestaInput) {
            this.rechazarBtn.addEventListener('click', () => this.showRechazarModal());
        }
        if (this.aprobarForm && this.aprobarInput) {
            this.aprobarForm.addEventListener('submit', e => {
                if (!this.aprobarInput.value) {
                    e.preventDefault();
                    this.showAprobarModal();
                }
            });
        }
    }

    showRechazarModal() {
        Swal.fire({
            theme: getCurrentTheme(),
            title: 'Rechazar apelación',
            input: 'textarea',
            inputLabel: 'Respuesta',
            inputPlaceholder: 'Escribe el motivo del rechazo',
            showCancelButton: true,
            confirmButtonColor: '#0b545b',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Rechazar'
        }).then(result => {
            if (result.isConfirmed && result.value) {
                this.respuestaInput.value = result.value;
                this.rechazarForm.submit();
            }
        });
    }

    showAprobarModal() {
        Swal.fire({
            theme: getCurrentTheme(),
            title: 'Aprobar apelación',
            input: 'textarea',
            inputLabel: 'Respuesta',
            inputPlaceholder: 'Escribe la respuesta de aprobación',
            showCancelButton: true,
            confirmButtonColor: '#0099a8',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Aprobar'
        }).then(result => {
            if (result.isConfirmed && result.value) {
                this.aprobarInput.value = result.value;
                this.aprobarForm.submit();
            }
        });
    }
}