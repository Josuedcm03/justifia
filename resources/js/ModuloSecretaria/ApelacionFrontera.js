export default class ApelacionFrontera {
    constructor(container, options = {}) {
        this.container = container;
        this.theme = options.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        this.rechazarBtn = container.querySelector('#rechazar-btn');
        this.rechazarForm = container.querySelector('#rechazar-form');
        this.respuestaInput = container.querySelector('#respuesta-input');
        this.aprobarForm = container.querySelector('#aprobar-form');
        this.confirmed = false;
        this.registerEvents();
    }

    registerEvents() {
        if (this.rechazarBtn && this.rechazarForm && this.respuestaInput) {
            this.rechazarBtn.addEventListener('click', () => this.showRechazarModal());
        }
        if (this.aprobarForm) {
            this.aprobarForm.addEventListener('submit', e => {
                if (!this.confirmed) {
                    e.preventDefault();
                    Swal.fire({
                        theme: this.theme,
                        title: '¿Aprobar apelación?',
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonColor: '#0b545b',
                        confirmButtonText: 'Sí, aprobar',
                        cancelButtonText: 'Cancelar'
                    }).then(result => {
                        if (result.isConfirmed) {
                            this.confirmed = true;
                            this.aprobarForm.submit();
                        }
                    });
                }
            });
        }
    }

    showRechazarModal() {
        Swal.fire({
            theme: this.theme,
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
}