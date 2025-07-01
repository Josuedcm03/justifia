import './bootstrap';

import Alpine from 'alpinejs';
import SolicitudEstudianteFrontera from './ModuloEstudiante/SolicitudFrontera';
import ApelacionEstudianteFrontera from './ModuloEstudiante/ApelacionFrontera';
import SolicitudSecretariaFrontera from './ModuloSecretaria/SolicitudFrontera';
import ApelacionSecretariaFrontera from './ModuloSecretaria/ApelacionFrontera';
import ReprogramacionDocenteFrontera from './ModuloDocente/ReprogramacionFrontera';
import AsistenciaFrontera from './ModuloDocente/AsistenciaFrontera';

window.Alpine = Alpine;

document.addEventListener('alpine:init', () => {
    Alpine.store('theme', {
        dark: localStorage.getItem('theme') === 'dark',
        toggle() {
            this.dark = !this.dark;
            this.apply();
            localStorage.setItem('theme', this.dark ? 'dark' : 'light');
        },
        apply() {
            if (this.dark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        },
    });

    Alpine.store('theme').apply();
});

Alpine.start();

document.addEventListener('DOMContentLoaded', () => {
    const solicitudFormEl = document.querySelector('[data-solicitud-estudiante-frontera]');
    if (solicitudFormEl) {
        new SolicitudEstudianteFrontera(solicitudFormEl, { isUpdate: solicitudFormEl.dataset.update === 'true' });
    }

    const apelacionFormEl = document.querySelector('[data-apelacion-estudiante-frontera]');
    if (apelacionFormEl) {
        new ApelacionEstudianteFrontera(apelacionFormEl);
    }

    const resolverEl = document.querySelector('[data-solicitud-secretaria-frontera]');
    if (resolverEl) {
        new SolicitudSecretariaFrontera(resolverEl);
    }

    const apelacionSecretariaEl = document.querySelector('[data-apelacion-secretaria-frontera]');
    if (apelacionSecretariaEl) {
        new ApelacionSecretariaFrontera(apelacionSecretariaEl);
    }

    document.querySelectorAll('[data-reprogramacion-docente-frontera]').forEach(form => {
        new ReprogramacionDocenteFrontera(form);
    });

    document.querySelectorAll('[data-asistencia-docente-frontera]').forEach(card => {
        new AsistenciaFrontera(card);
    });
});