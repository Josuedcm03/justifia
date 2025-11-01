import './bootstrap';

import Alpine from 'alpinejs';
import SolicitudEstudianteFrontera from './presentation/estudiante/SolicitudFrontera';
import ApelacionEstudianteFrontera from './presentation/estudiante/ApelacionFrontera';
import SolicitudSecretariaFrontera from './presentation/secretaria/SolicitudFrontera';
import ApelacionSecretariaFrontera from './presentation/secretaria/ApelacionFrontera';
import TipoConstanciaFrontera from './presentation/secretaria/TipoConstanciaFrontera';
import CarreraFrontera from './presentation/secretaria/CarreraFrontera';
import AsignaturaFrontera from './presentation/secretaria/AsignaturaFrontera';
import FacultadFrontera from './presentation/secretaria/FacultadFrontera';
import DocenteFrontera from './presentation/secretaria/DocenteFrontera';
import ImportFrontera from './presentation/secretaria/ImportFrontera';
import ReprogramacionDocenteFrontera from './presentation/docente/ReprogramacionFrontera';
import AsistenciaFrontera from './presentation/docente/AsistenciaFrontera';

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

    document.querySelectorAll('[data-tipo-constancia-frontera]').forEach(form => {
        new TipoConstanciaFrontera(form);
    });

    document.querySelectorAll('[data-carrera-frontera]').forEach(form => {
        new CarreraFrontera(form);
    });

    document.querySelectorAll('[data-asignatura-frontera]').forEach(form => {
        new AsignaturaFrontera(form);
    });

    document.querySelectorAll('[data-facultad-frontera]').forEach(form => {
        new FacultadFrontera(form);
    });

    document.querySelectorAll('[data-docente-frontera]').forEach(form => {
        new DocenteFrontera(form);
    });

    document.querySelectorAll('[data-import-frontera]').forEach(form => {
        new ImportFrontera(form);
    });

    document.querySelectorAll('[data-reprogramacion-docente-frontera]').forEach(form => {
        new ReprogramacionDocenteFrontera(form);
    });

    document.querySelectorAll('[data-asistencia-card]').forEach(card => {
        new AsistenciaFrontera(card);
    });

    const loader = document.getElementById('page-loader');
    if (loader) {
        window.addEventListener('load', () => loader.classList.add('hidden'));
        window.addEventListener('beforeunload', () => loader.classList.remove('hidden'));
    }
});