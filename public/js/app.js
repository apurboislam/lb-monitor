const socket = io();

// State
let currentDomain = null;
const domains = new Set();
let maxLogs = 100;

// Elements
const cpuVal = document.getElementById('cpu-val');
const cpuBar = document.getElementById('cpu-bar');
const memVal = document.getElementById('mem-val');
const memBar = document.getElementById('mem-bar');
const diskVal = document.getElementById('disk-val');
const diskBar = document.getElementById('disk-bar');
const netSpeedVal = document.getElementById('net-speed-val');
const bwTodayVal = document.getElementById('bw-today-val');
const bwMonthVal = document.getElementById('bw-month-val');
const domainListEl = document.getElementById('domain-list');
const logsContainer = document.getElementById('logs-container');
const currentDomainEl = document.getElementById('current-domain');
const clearLogsBtn = document.getElementById('clear-logs');
const logoutBtn = document.getElementById('logout-btn');
const maxLogsSelect = document.getElementById('max-logs-select');
const modal = document.getElementById('log-modal');
const modalBody = document.getElementById('modal-body');
const closeModalBtn = document.getElementById('close-modal');

// Helper to format bytes
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
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
        const rx = formatBytes(stats.network.speed.rx);
        const tx = formatBytes(stats.network.speed.tx);
        netSpeedVal.textContent = `${rx}/s / ${tx}/s`;

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
        const div = document.createElement('div');
        div.className = `domain-item ${domain === currentDomain ? 'active' : ''}`;
        div.textContent = domain;
        div.onclick = () => switchDomain(domain);
        domainListEl.appendChild(div);
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

    socket.emit('join_room', `logs:${domain}`);
    socket.emit('fetch_history', domain);
}

function appendLog(entry) {
    const div = document.createElement('div');
    div.className = 'log-card';

    const status = entry.status || '-';
    const statusClass = status >= 500 ? 'status-5xx' :
        status >= 400 ? 'status-4xx' :
            status >= 200 ? 'status-2xx' : '';

    const ts = new Date(entry.ts * 1000).toLocaleTimeString();
    const method = entry.request?.method || '-';
    const uri = entry.request?.uri || '-';

    div.innerHTML = `
        <div class="log-time">${ts}</div>
        <div class="log-info">
            <span class="method ${method}">${method}</span>
            <span class="log-path" title="${uri}">${uri}</span>
        </div>
        <div class="status-badge ${statusClass}">${status}</div>
        <button class="view-btn" title="View Details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
    `;

    // Add click handler for view button
    const viewBtn = div.querySelector('.view-btn');
    viewBtn.onclick = () => openModal(entry);

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
        ['Remote IP (Edge)', entry.request?.remote_ip || '-'],
        ['Real User IP', entry.request?.headers?.['X-Forwarded-For']?.[0] || entry.request?.client_ip || '-'],
        ['CF Ray ID', entry.request?.headers?.['Cf-Ray']?.[0] || '-'],
        ['User Agent', entry.request?.headers?.['User-Agent']?.[0] || '-'],
        ['Referer', entry.request?.headers?.['Referer']?.[0] || '-'],
        ['Protocol', entry.request?.proto || '-'],
        ['Host', entry.request?.host || '-']
    ];

    modalBody.innerHTML = rows.map(([label, value]) => `
        <div class="modal-row">
            <div class="modal-label">${label}</div>
            <div class="modal-value">${value}</div>
        </div>
    `).join('');

    modal.classList.add('show');
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

    // If we have a current domain, clear and re-fetch to ensure we have enough logs
    // or to trim if we decreased the limit.
    if (currentDomain) {
        logsContainer.innerHTML = '';
        socket.emit('fetch_history', currentDomain);
    }
};

closeModalBtn.onclick = () => {
    modal.classList.remove('show');
};

window.onclick = (e) => {
    if (e.target === modal) {
        modal.classList.remove('show');
    }
};

// Auth Error Handling
socket.on('connect_error', (err) => {
    if (err.message === 'Unauthorized') {
        window.location.href = '/login';
    }
});
