const socket = io();

// State
const state = {
    currentDomain: null,
    domains: new Set(),
    maxLogs: 50,
    isMobileMenuOpen: false
};

// DOM Elements
const ui = {
    cpuVal: document.getElementById('cpu-val'),
    cpuBar: document.getElementById('cpu-bar'),
    memVal: document.getElementById('mem-val'),
    memBar: document.getElementById('mem-bar'),

    netDown: document.getElementById('net-down'),
    netUp: document.getElementById('net-up'),
    bwToday: document.getElementById('bw-today-val'),
    bwMonth: document.getElementById('bw-month-val'),

    domainList: document.getElementById('domain-list'),
    logsContainer: document.getElementById('logs-container'),
    currentDomainTitle: document.getElementById('current-domain'),

    modal: document.getElementById('log-modal'),
    modalBody: document.getElementById('modal-body'),

    sidebar: document.getElementById('sidebar'),
    menuToggle: document.getElementById('menu-toggle'),
    menuClose: document.getElementById('menu-close')
};

// --- Utilities ---

function formatBytes(bytes, decimals = 1) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

function getMethodClass(method) {
    const m = (method || '').toUpperCase();
    if (['GET', 'POST', 'PUT', 'DELETE'].includes(m)) return `method-${m}`;
    return '';
}

function getStatusClass(status) {
    const s = parseInt(status);
    if (s >= 500) return 'status-5xx';
    if (s >= 400) return 'status-4xx';
    if (s >= 300) return 'status-3xx';
    return 'status-2xx';
}

// --- Socket Events ---

socket.on('stats', (stats) => {
    // CPU
    ui.cpuVal.textContent = `${stats.cpu}%`;
    ui.cpuBar.style.width = `${stats.cpu}%`;

    // Memory
    ui.memVal.textContent = `${stats.mem.percentage}%`;
    ui.memBar.style.width = `${stats.mem.percentage}%`;

    // Network Speed
    if (stats.network && stats.network.speed) {
        ui.netDown.textContent = formatBytes(stats.network.speed.rx) + '/s';
        ui.netUp.textContent = formatBytes(stats.network.speed.tx) + '/s';
    }

    // Bandwidth
    if (stats.network && stats.network.bandwidth) {
        ui.bwToday.textContent = formatBytes(stats.network.bandwidth.today.total);
        ui.bwMonth.textContent = formatBytes(stats.network.bandwidth.month.total);
    }
});

socket.on('new_domain', (domain) => {
    if (!state.domains.has(domain)) {
        state.domains.add(domain);
        renderDomainList();
    }
});

socket.on('log', (data) => {
    if (data.domain === state.currentDomain) {
        addLogEntry(data.entry);
    }
});

socket.on('log_all', (data) => {
    if (!state.domains.has(data.domain)) {
        state.domains.add(data.domain);
        renderDomainList();
    }
});

// --- UI Logic ---

function renderDomainList() {
    ui.domainList.innerHTML = '';

    if (state.domains.size === 0) {
        ui.domainList.innerHTML = '<div class="empty-state-small">Scanning...</div>';
        return;
    }

    state.domains.forEach(domain => {
        const div = document.createElement('div');
        div.className = `domain-item ${domain === state.currentDomain ? 'active' : ''}`;
        div.innerHTML = `<i data-lucide="globe" style="width:14px; display:inline; margin-right:8px"></i>${domain}`;
        div.onclick = () => switchDomain(domain);
        ui.domainList.appendChild(div);
    });

    // Re-init icons for new elements
    if (window.lucide) lucide.createIcons();
}

function switchDomain(domain) {
    if (state.currentDomain) {
        socket.emit('leave_room', `logs:${state.currentDomain}`);
    }

    state.currentDomain = domain;
    ui.currentDomainTitle.textContent = domain;
    ui.logsContainer.innerHTML = ''; // Clear current logs

    renderDomainList(); // Update active class

    socket.emit('join_room', `logs:${domain}`);
    socket.emit('fetch_history', domain);

    // Close mobile menu if open
    if (state.isMobileMenuOpen) toggleMobileMenu();
}

function addLogEntry(entry) {
    // Remove empty state if present
    const emptyState = ui.logsContainer.querySelector('.empty-feed');
    if (emptyState) emptyState.remove();

    const row = document.createElement('div');
    row.className = 'log-row';

    const time = new Date(entry.ts * 1000).toLocaleTimeString([], { hour12: false });
    const method = entry.request?.method || '-';
    const status = entry.status || 0;
    const uri = entry.request?.uri || '/';

    // Store entry data for modal
    row.dataset.entry = JSON.stringify(entry);

    row.innerHTML = `
        <div class="col-time">${time}</div>
        <div class="col-method"><span class="badge ${getMethodClass(method)}">${method}</span></div>
        <div class="col-status"><span class="${getStatusClass(status)}">${status}</span></div>
        <div class="col-path" title="${uri}">${uri}</div>
        <div class="col-action">
            <button class="icon-btn view-details">
                <i data-lucide="eye" style="width:16px;"></i>
            </button>
        </div>
    `;

    // Add click event for details
    row.querySelector('.view-details').onclick = () => openModal(entry);

    // Prepend
    ui.logsContainer.insertBefore(row, ui.logsContainer.firstChild);

    // Cleanup old logs
    while (ui.logsContainer.children.length > state.maxLogs) {
        ui.logsContainer.removeChild(ui.logsContainer.lastChild);
    }

    if (window.lucide) lucide.createIcons({ root: row });
}

// --- Modal ---

function openModal(entry) {
    const d = new Date(entry.ts * 1000);
    const meta = entry.request || {};

    const fields = [
        { label: 'Time', val: d.toLocaleString() },
        { label: 'Full URL', val: `${meta.proto}://${meta.host}${meta.uri}` },
        { label: 'Client IP', val: meta.client_ip || 'Unknown' },
        { label: 'User Agent', val: meta.headers?.['User-Agent']?.[0] || '-' },
        { label: 'Latency', val: (entry.duration * 1000).toFixed(2) + ' ms' },
        { label: 'CF Ray ID', val: meta.headers?.['Cf-Ray']?.[0] || '-' }
    ];

    ui.modalBody.innerHTML = fields.map(f => `
        <div class="detail-row">
            <span class="detail-label">${f.label}</span>
            <div class="detail-val">${f.val}</div>
        </div>
    `).join('');

    ui.modal.classList.add('active');
}

document.getElementById('close-modal').onclick = () => ui.modal.classList.remove('active');
ui.modal.onclick = (e) => {
    if (e.target === ui.modal) ui.modal.classList.remove('active');
};

// --- Settings & Actions ---

document.getElementById('clear-logs').onclick = () => {
    ui.logsContainer.innerHTML = `
        <div class="empty-feed">
            <i data-lucide="check-circle" style="opacity: 0.2; width: 48px; height: 48px;"></i>
            <p>Buffer Cleared</p>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
};

document.getElementById('max-logs-select').onchange = (e) => {
    state.maxLogs = parseInt(e.target.value);
    if (state.currentDomain) {
        // Refresh to apply limit or fetch more
        ui.logsContainer.innerHTML = '';
        socket.emit('fetch_history', state.currentDomain);
    }
};

document.getElementById('logout-btn').onclick = async () => {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (e) { console.error('Logout failed', e); }
};

// --- Mobile Menu ---

function toggleMobileMenu() {
    state.isMobileMenuOpen = !state.isMobileMenuOpen;
    ui.sidebar.classList.toggle('active', state.isMobileMenuOpen);
}

ui.menuToggle.onclick = toggleMobileMenu;
ui.menuClose.onclick = toggleMobileMenu;

// Auth Error Check
socket.on('connect_error', (err) => {
    if (err.message === 'Unauthorized') window.location.href = '/login';
});