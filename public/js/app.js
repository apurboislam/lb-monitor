const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const logoutBtn = document.getElementById('logout-btn');
    const pageTitle = document.getElementById('page-title');
    const domainCountEl = document.getElementById('domain-count');
    const domainListEl = document.getElementById('domain-list');
    const currentDomainBadge = document.getElementById('current-domain-badge');

    // Stats Elements
    const cpuVal = document.getElementById('cpu-val');
    const cpuBar = document.getElementById('cpu-bar');
    const ramVal = document.getElementById('ram-val');
    const ramBar = document.getElementById('ram-bar');
    const diskVal = document.getElementById('disk-val');
    const diskBar = document.getElementById('disk-bar');
    const uptimeVal = document.getElementById('uptime-val');

    // Network Elements
    const netDown = document.getElementById('net-down');
    const netUp = document.getElementById('net-up');
    const bwToday = document.getElementById('bw-today');
    const bwMonth = document.getElementById('bw-month');

    // Logs Elements
    const logsTableBody = document.getElementById('logs-table-body');
    const rowsSelect = document.getElementById('rows-select');
    const clearLogsBtn = document.getElementById('clear-logs');
    const emptyState = document.getElementById('empty-state');
    const detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
    const modalContent = document.getElementById('modal-content');

    // --- State ---
    let chartInstance = null;
    let maxRows = 50;
    let currentDomain = null;
    const domains = new Set();

    // --- Initialization ---
    initChart();

    // --- Socket.IO Events ---

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('connect_error', (err) => {
        if (err.message === 'Unauthorized') {
            window.location.href = '/login';
        }
    });

    // System Stats
    socket.on('stats', (stats) => {
        updateStats(stats);
        updateChart(stats);
    });

    // Domain Discovery
    socket.on('new_domain', (domain) => {
        if (!domains.has(domain)) {
            domains.add(domain);
            renderSidebar();
        }
    });

    // Logs
    socket.on('log', (data) => {
        const { domain, entry } = data;
        // If viewing specific domain, only show that domain's logs
        // If viewing all (currentDomain is null), show all? 
        // Logic: If currentDomain is set, filter. If not, maybe show all or nothing?
        // Let's assume default is "Select a Domain" or show all if we want.
        // For now, let's match the previous logic: if currentDomain matches, append.

        if (currentDomain && domain === currentDomain) {
            appendLog(entry, domain);
        }
    });

    socket.on('log_all', (data) => {
        // This event might be useful if we want a "Global" view
        const { domain } = data;
        if (!domains.has(domain)) {
            domains.add(domain);
            renderSidebar();
        }
    });

    // --- UI Functions ---

    function updateStats(stats) {
        // CPU
        cpuVal.textContent = `${stats.cpu}%`;
        cpuBar.style.width = `${stats.cpu}%`;

        // RAM
        ramVal.textContent = `${stats.mem.percentage}%`;
        ramBar.style.width = `${stats.mem.percentage}%`;

        // Disk (First one)
        if (stats.disk && stats.disk.length > 0) {
            const root = stats.disk[0];
            diskVal.textContent = `${root.percentage}%`;
            diskBar.style.width = `${root.percentage}%`;
        }

        // Network
        if (stats.network) {
            netDown.textContent = formatSpeed(stats.network.speed.rx);
            netUp.textContent = formatSpeed(stats.network.speed.tx);

            bwToday.textContent = formatBytes(stats.network.bandwidth.today.total);
            bwMonth.textContent = formatBytes(stats.network.bandwidth.month.total);
        }

        // Uptime
        if (stats.uptime) {
            const d = Math.floor(stats.uptime / (3600 * 24));
            const h = Math.floor(stats.uptime % (3600 * 24) / 3600);
            const m = Math.floor(stats.uptime % 3600 / 60);
            const s = Math.floor(stats.uptime % 60);
            uptimeVal.textContent = `${d}d ${h}h ${m}m ${s}s`;
        }
    }

    function initChart() {
        const ctx = document.getElementById('liveChart').getContext('2d');

        const gradientCpu = ctx.createLinearGradient(0, 0, 0, 400);
        gradientCpu.addColorStop(0, 'rgba(13, 202, 240, 0.5)');
        gradientCpu.addColorStop(1, 'rgba(13, 202, 240, 0.0)');

        const gradientRam = ctx.createLinearGradient(0, 0, 0, 400);
        gradientRam.addColorStop(0, 'rgba(255, 193, 7, 0.5)');
        gradientRam.addColorStop(1, 'rgba(255, 193, 7, 0.0)');

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [
                    {
                        label: 'CPU',
                        data: Array(20).fill(0),
                        borderColor: '#0dcaf0',
                        backgroundColor: gradientCpu,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'RAM',
                        data: Array(20).fill(0),
                        borderColor: '#ffc107',
                        backgroundColor: gradientRam,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#c9d1d9' } } },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#8b949e' }
                    },
                    x: { display: false }
                },
                animation: { duration: 0 }
            }
        });
    }

    function updateChart(stats) {
        if (!chartInstance) return;

        const dataCpu = chartInstance.data.datasets[0].data;
        const dataRam = chartInstance.data.datasets[1].data;

        dataCpu.shift();
        dataRam.shift();

        dataCpu.push(stats.cpu);
        dataRam.push(stats.mem.percentage);

        chartInstance.update();
    }

    function renderSidebar() {
        domainCountEl.textContent = domains.size;

        if (domains.size === 0) {
            domainListEl.innerHTML = '<li class="nav-item text-center text-secondary small mt-3">No domains found</li>';
            return;
        }

        domainListEl.innerHTML = Array.from(domains).map(d => `
            <li class="nav-item">
                <a href="#" class="nav-link ${d === currentDomain ? 'active' : ''}" data-domain="${d}">
                    <i class="fa-solid fa-globe me-2"></i> ${d}
                </a>
            </li>
        `).join('');

        // Add click listeners
        domainListEl.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const domain = link.getAttribute('data-domain');
                switchDomain(domain);
            });
        });
    }

    function switchDomain(domain) {
        if (currentDomain) {
            socket.emit('leave_room', `logs:${currentDomain}`);
        }

        currentDomain = domain;
        currentDomainBadge.textContent = domain;
        // pageTitle.textContent = `Logs: ${domain}`; // Keep System Overview static

        // Update active state in sidebar
        renderSidebar();

        // Clear logs
        logsTableBody.innerHTML = '';
        checkEmptyState();

        // Join new room and fetch history
        socket.emit('join_room', `logs:${domain}`);
        socket.emit('fetch_history', domain);

        // Close mobile sidebar
        const sidebarMenu = document.getElementById('sidebarMenu');
        const bsOffcanvas = bootstrap.Collapse.getInstance(sidebarMenu);
        if (bsOffcanvas) bsOffcanvas.hide();
    }

    function appendLog(entry, domain) {
        const time = new Date(entry.ts * 1000).toLocaleTimeString();
        const method = entry.request?.method || '-';
        const status = entry.status || '-';
        const path = entry.request?.uri || '-';

        const row = document.createElement('tr');
        row.className = 'log-row-enter';

        let statusClass = 'text-light';
        if (status >= 200 && status < 300) statusClass = 'text-status-2xx';
        else if (status >= 300 && status < 400) statusClass = 'text-status-3xx';
        else if (status >= 400 && status < 500) statusClass = 'text-status-4xx';
        else if (status >= 500) statusClass = 'text-status-5xx';

        row.innerHTML = `
            <td class="ps-4 font-monospace text-secondary small">${time}</td>
            <td><span class="badge badge-method-${method}">${method}</span></td>
            <td><span class="fw-bold ${statusClass}">${status}</span></td>
            <td class="text-truncate" style="max-width: 200px;" title="${path}">${path}</td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-secondary border-0 text-light view-details-btn">
                    <i class="fa-solid fa-eye"></i>
                </button>
            </td>
        `;

        row.addEventListener('click', () => showLogDetails(entry));

        logsTableBody.prepend(row);

        // Limit rows
        while (logsTableBody.children.length > maxRows) {
            logsTableBody.removeChild(logsTableBody.lastChild);
        }

        checkEmptyState();
    }

    function showLogDetails(entry) {
        const ts = new Date(entry.ts * 1000).toLocaleString();
        const duration = entry.duration ? (entry.duration * 1000).toFixed(2) + ' ms' : '0 ms';

        const details = [
            { label: 'Timestamp', value: ts },
            { label: 'Method', value: entry.request?.method || '-' },
            { label: 'URI', value: entry.request?.uri || '-' },
            { label: 'Status', value: entry.status || '-' },
            { label: 'Duration', value: duration },
            { label: 'Remote IP', value: entry.request?.remote_ip || '-' },
            { label: 'Real User IP', value: entry.request?.headers?.['X-Forwarded-For']?.[0] || entry.request?.client_ip || '-' },
            { label: 'Ray ID', value: entry.request?.headers?.['Cf-Ray']?.[0] || entry.request?.headers?.['cf-ray']?.[0] || '-' },
            { label: 'User Agent', value: entry.request?.headers?.['User-Agent']?.[0] || '-' },
            { label: 'Referer', value: entry.request?.headers?.['Referer']?.[0] || '-' },
            { label: 'Host', value: entry.request?.host || '-' }
        ];

        modalContent.innerHTML = details.map(item => `
            <div class="col-md-6">
                <div class="modal-label">${item.label}</div>
                <div class="modal-value">${item.value}</div>
            </div>
        `).join('');

        detailsModal.show();
    }

    function checkEmptyState() {
        if (logsTableBody.children.length === 0) {
            emptyState.classList.remove('d-none');
        } else {
            emptyState.classList.add('d-none');
        }
    }

    // --- Helpers ---
    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    function formatSpeed(bytesPerSec) {
        return formatBytes(bytesPerSec) + '/s';
    }

    // --- Event Listeners ---
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch (err) {
            console.error('Logout failed', err);
        }
    });

    rowsSelect.addEventListener('change', (e) => {
        maxRows = parseInt(e.target.value);
        while (logsTableBody.children.length > maxRows) {
            logsTableBody.removeChild(logsTableBody.lastChild);
        }
    });

    clearLogsBtn.addEventListener('click', () => {
        logsTableBody.innerHTML = '';
        checkEmptyState();
    });
});
