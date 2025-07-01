export default class AsistenciaFrontera {
    constructor(card) {
        this.card = card;
        this.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        this.form = card.querySelector('[data-asistencia-form]');
        this.init();
    }

    init() {
        if (!this.form) return;
        this.card.addEventListener('click', () => this.showModal());
    }

    showModal() {
        Swal.fire({
            theme: this.theme,
            title: 'Registrar asistencia',
            showDenyButton: true,
            confirmButtonColor: '#0b545b',
            denyButtonColor: '#b91c1c',
            confirmButtonText: 'Asist\u00f3',
            denyButtonText: 'No asisti\u00f3'
        }).then(result => {
            if (result.isConfirmed || result.isDenied) {
                this.form.querySelector('[name="asistencia"]').value = result.isConfirmed ? 'asistio' : 'no_asistio';
                this.form.submit();
            }
        });
    }
}