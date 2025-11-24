const socket = io();

// State
let currentDomain = null;
const domains = new Set();
let maxLogs = 50;
let logModal = null; // Bootstrap Modal instance

// Elements
const cpuVal = document.getElementById('cpu-val');
const cpuBar = document.getElementById('cpu-bar');
const memVal = document.getElementById('mem-val');
const memBar = document.getElementById('mem-bar');
const diskVal = document.getElementById('disk-val');
const diskBar = document.getElementById('disk-bar');
const netSpeedDown = document.getElementById('net-speed-down');
const netSpeedUp = document.getElementById('net-speed-up');
const bwTodayVal = document.getElementById('bw-today-val');
const bwMonthVal = document.getElementById('bw-month-val');
const domainListEl = document.getElementById('domain-list');
const logsContainer = document.getElementById('logs-container');
const currentDomainEl = document.getElementById('current-domain');
const clearLogsBtn = document.getElementById('clear-logs');
const logoutBtn = document.getElementById('logout-btn');
const maxLogsSelect = document.getElementById('max-logs-select');
const modalBody = document.getElementById('modal-body');

// Initialize Bootstrap Modal
document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('log-modal');
    if (modalEl) {
        logModal = new bootstrap.Modal(modalEl);
    }
});

// Helper to format bytes
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Helper to format speed (e.g., 1000 KB/s -> 1 MB/s)
function formatSpeed(bytesPerSec) {
    return formatBytes(bytesPerSec) + '/s';
}

// System Stats
socket.on('stats', (stats) => {
    cpuVal.textContent = `${stats.cpu}%`;
    cpuBar.style.width = `${stats.cpu}%`;

    memVal.textContent = `${stats.mem.percentage}%`;
    memBar.style.width = `${stats.mem.percentage}%`;

    // Use the first disk (usually root)
    if (stats.disk && stats.disk.length > 0) {
        const rootDisk = stats.disk[0];
        diskVal.textContent = `${rootDisk.percentage}%`;
        diskBar.style.width = `${rootDisk.percentage}%`;
    }

    // Network Stats
    if (stats.network) {
        const rx = formatSpeed(stats.network.speed.rx);
        const tx = formatSpeed(stats.network.speed.tx);

        if (netSpeedDown) netSpeedDown.textContent = rx;
        if (netSpeedUp) netSpeedUp.textContent = tx;

        const todayTotal = formatBytes(stats.network.bandwidth.today.total);
        bwTodayVal.textContent = todayTotal;

        const monthTotal = formatBytes(stats.network.bandwidth.month.total);
        bwMonthVal.textContent = monthTotal;
    }
});

// Log Handling
socket.on('new_domain', (domain) => {
    if (!domains.has(domain)) {
        domains.add(domain);
        renderDomainList();
    }
});

socket.on('log_all', (data) => {
    const { domain } = data;
    if (!domains.has(domain)) {
        domains.add(domain);
        renderDomainList();
    }
});

socket.on('log', (data) => {
    const { domain, entry } = data;
    if (domain === currentDomain) {
        appendLog(entry);
    }
});

// UI Functions
function renderDomainList() {
    domainListEl.innerHTML = '';
    domains.forEach(domain => {
        const button = document.createElement('button');
        button.className = `list-group-item list-group-item-action domain-item bg-transparent border-0 ${domain === currentDomain ? 'active' : ''}`;
        button.textContent = domain;
        button.onclick = () => switchDomain(domain);
        domainListEl.appendChild(button);
    });
}

function switchDomain(domain) {
    if (currentDomain) {
        socket.emit('leave_room', `logs:${currentDomain}`);
    }

    currentDomain = domain;
    currentDomainEl.textContent = domain;
    logsContainer.innerHTML = ''; // Clear logs on switch
    renderDomainList(); // Update active state

    // Close mobile sidebar if open
    const sidebarMenu = document.getElementById('sidebarMenu');
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebarMenu);
    if (bsOffcanvas) {
        bsOffcanvas.hide();
    }

    socket.emit('join_room', `logs:${domain}`);
    socket.emit('fetch_history', domain);
}

function appendLog(entry) {
    const div = document.createElement('div');

    const status = entry.status || '-';
    let statusClass = '';
    if (status >= 500) statusClass = 'status-5xx';
    else if (status >= 400) statusClass = 'status-4xx';
    else if (status >= 200) statusClass = 'status-2xx';

    const ts = new Date(entry.ts * 1000).toLocaleTimeString();
    const method = entry.request?.method || '-';
    const uri = entry.request?.uri || '-';

    div.className = `log-card d-flex align-items-center gap-3 ${statusClass}`;

    div.innerHTML = `
        <div class="text-secondary font-monospace small" style="min-width: 80px;">${ts}</div>
        <div class="method-badge method-${method}">${method}</div>
        <div class="log-uri text-truncate flex-grow-1" title="${uri}">${uri}</div>
        <div class="badge bg-dark border border-secondary text-light font-monospace">${status}</div>
        <button class="btn btn-sm btn-link text-secondary p-0 view-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
    `;

    // Add click handler for view button
    const viewBtn = div.querySelector('.view-btn');
    viewBtn.onclick = (e) => {
        e.stopPropagation();
        openModal(entry);
    };

    // Also make the whole card clickable for easier mobile use
    div.onclick = () => openModal(entry);
    div.style.cursor = 'pointer';

    logsContainer.insertBefore(div, logsContainer.firstChild);

    // Enforce max logs limit
    while (logsContainer.children.length > maxLogs) {
        logsContainer.removeChild(logsContainer.lastChild);
    }
}

function openModal(entry) {
    const ts = new Date(entry.ts * 1000).toLocaleString();
    const duration = entry.duration ? (entry.duration * 1000).toFixed(2) + 'ms' : '0ms';

    const rows = [
        ['Timestamp', ts],
        ['Method', entry.request?.method || '-'],
        ['URI', entry.request?.uri || '-'],
        ['Status', entry.status || '-'],
        ['Duration', duration],
        ['Remote IP', entry.request?.remote_ip || '-'],
        ['Real User IP', entry.request?.headers?.['X-Forwarded-For']?.[0] || entry.request?.client_ip || '-'],
        ['Ray ID', entry.request?.headers?.['Cf-Ray']?.[0] || entry.request?.headers?.['cf-ray']?.[0] || '-'],
        ['User Agent', entry.request?.headers?.['User-Agent']?.[0] || '-'],
        ['Referer', entry.request?.headers?.['Referer']?.[0] || '-'],
        ['Host', entry.request?.host || '-']
    ];

    modalBody.innerHTML = rows.map(([label, value]) => `
        <div class="modal-row">
            <div class="modal-label">${label}</div>
            <div class="modal-value">${value}</div>
        </div>
    `).join('');

    if (logModal) {
        logModal.show();
    }
}

// Event Listeners
clearLogsBtn.onclick = () => {
    logsContainer.innerHTML = '';
};

logoutBtn.onclick = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
};

maxLogsSelect.onchange = (e) => {
    maxLogs = parseInt(e.target.value);
    if (currentDomain) {
        logsContainer.innerHTML = '';
        socket.emit('fetch_history', currentDomain);
    }
};

// Auth Error Handling
socket.on('connect_error', (err) => {
    if (err.message === 'Unauthorized') {
        window.location.href = '/login';
    }
});
