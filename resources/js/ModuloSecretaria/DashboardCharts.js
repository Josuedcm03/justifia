import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export default class DashboardCharts {
    constructor(container) {
        this.container = container;
        this.fetchData();
    }

    async fetchData() {
        try {
            const response = await fetch('/secretaria/dashboard/stats');
            const data = await response.json();
            this.renderCharts(data);
        } catch (err) {
            console.error('Error loading stats', err);
        }
    }

    renderCharts(data) {
        this.renderSolicitudesChart(data.solicitudes);
        this.renderApelacionesChart(data.apelaciones);
        this.renderCarrerasChart(data.carreras);
        this.renderFacultadesChart(data.facultades);
    }

    renderSolicitudesChart(stats) {
        const el = this.container.querySelector('#chart-solicitudes');
        if (!el) return;
        new Chart(el, {
            type: 'doughnut',
            data: {
                labels: ['Aprobadas', 'Pendientes', 'Rechazadas'],
                datasets: [{
                    data: [stats.aprobadas, stats.pendientes, stats.rechazadas],
                    backgroundColor: ['#16a34a', '#eab308', '#dc2626'],
                }]
            },
            options: { maintainAspectRatio: false }
        });
    }

    renderApelacionesChart(stats) {
        const el = this.container.querySelector('#chart-apelaciones');
        if (!el) return;
        new Chart(el, {
            type: 'doughnut',
            data: {
                labels: ['Aprobadas', 'Pendientes', 'Rechazadas'],
                datasets: [{
                    data: [stats.aprobadas, stats.pendientes, stats.rechazadas],
                    backgroundColor: ['#16a34a', '#eab308', '#dc2626'],
                }]
            },
            options: { maintainAspectRatio: false }
        });
    }

    renderCarrerasChart(items) {
        const el = this.container.querySelector('#chart-carreras');
        if (!el) return;
        new Chart(el, {
            type: 'bar',
            data: {
                labels: items.map(i => i.nombre),
                datasets: [{
                    label: 'Solicitudes',
                    data: items.map(i => i.total),
                    backgroundColor: '#0ea5e9',
                }]
            },
            options: { maintainAspectRatio: false }
        });
    }

    renderFacultadesChart(items) {
        const el = this.container.querySelector('#chart-facultades');
        if (!el) return;
        new Chart(el, {
            type: 'bar',
            data: {
                labels: items.map(i => i.nombre),
                datasets: [{
                    label: 'Solicitudes',
                    data: items.map(i => i.total),
                    backgroundColor: '#a855f7',
                }]
            },
            options: { maintainAspectRatio: false }
        });
    }
}