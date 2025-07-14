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
                backgroundColor: ['#00c951', '#efb100', '#fb2c36'],
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribución de Solicitudes'
                }
            }
        }
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
                backgroundColor: ['#00c951', '#efb100', '#fb2c36'],
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribución de Apelaciones'
                }
            }
        }
    });
}


renderCarrerasChart(items) {
    const el = this.container.querySelector('#chart-carreras');
    if (!el) return;

    new Chart(el, {
        type: 'bar',
        data: {
            labels: items.map(i => i.nombre),
            datasets: [
                {
                    label: 'Solicitudes',
                    data: items.map(i => i.solicitudes),
                    backgroundColor: '#0ea5e9',
                },
                {
                    label: 'Apelaciones',
                    data: items.map(i => i.apelaciones),
                    backgroundColor: '#f97316',
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        autoSkip: false,
                        maxRotation: 90,
                        minRotation: 30
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Solicitudes y Apelaciones por Carrera'
                }
            }
        }
    });
}

renderFacultadesChart(items) {
    const el = this.container.querySelector('#chart-facultades');
    if (!el) return;

    new Chart(el, {
        type: 'bar',
        data: {
            labels: items.map(i => i.nombre),
            datasets: [
                {
                    label: 'Solicitudes',
                    data: items.map(i => i.solicitudes),
                    backgroundColor: '#a855f7',
                },
                {
                    label: 'Apelaciones',
                    data: items.map(i => i.apelaciones),
                    backgroundColor: '#f97316',
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        autoSkip: false,
                        maxRotation: 90,
                        minRotation: 30
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Solicitudes y Apelaciones por Facultad'
                }
            }
        }
    });
}

}