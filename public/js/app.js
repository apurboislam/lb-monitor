const socket = io();

// State
let currentDomain = null;
const domains = new Set();
let maxLogs = 50;
let logModal = null;
let toastInstance = null;

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
const domainCountEl = document.getElementById('domain-count');
const logsContainer = document.getElementById('logs-container');
const currentDomainEl = document.getElementById('current-domain');
const clearLogsBtn = document.getElementById('clear-logs');
const logoutBtn = document.getElementById('logout-btn');
const maxLogsSelect = document.getElementById('max-logs-select');
const modalBody = document.getElementById('modal-body');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('log-modal');
    if (modalEl) {
        logModal = new bootstrap.Modal(modalEl);
    }

    const toastEl = document.getElementById('toast-notification');
    if (toastEl) {
        toastInstance = new bootstrap.Toast(toastEl, {
            animation: true,
            autohide: true,
            delay: 3000
        });
    }

    // Hide empty state initially
    hideEmptyState();
});

// Toast Notification Helper
function showToast(message, type = 'info') {
    const toastEl = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    
    if (!toastEl || !toastMessage || !toastIcon) return;

    // Set message
    toastMessage.textContent = message;

    // Set icon and class based on type
    toastEl.className = 'toast align-items-center border-0 toast-' + type;
    
    const icons = {
        success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };
    
    toastIcon.innerHTML = icons[type] || icons.info;

    if (toastInstance) {
        toastInstance.show();
    }
}

// Helper to format bytes
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Helper to format speed
function formatSpeed(bytesPerSec) {
    return formatBytes(bytesPerSec) + '/s';
}

// Animate number change
function animateValue(element, start, end, duration = 500) {
    if (!element) return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            element.textContent = Math.round(end) + '%';
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current) + '%';
        }
    }, 16);
}

// Update progress bar with animation
function updateProgressBar(bar, value) {
    if (!bar) return;
    
    bar.style.width = value + '%';
    
    // Change color based on value
    if (value >= 90) {
        bar.classList.add('bg-danger');
        bar.classList.remove('bg-warning', 'bg-success');
    } else if (value >= 75) {
        bar.classList.add('bg-warning');
        bar.classList.remove('bg-danger', 'bg-success');
    } else {
        bar.classList.remove('bg-danger', 'bg-warning');
    }
}

// System Stats
socket.on('stats', (stats) => {
    // CPU
    if (cpuVal && cpuBar) {
        const currentCpu = parseFloat(cpuVal.textContent) || 0;
        if (Math.abs(currentCpu - stats.cpu) > 0.5) {
            cpuVal.textContent = `${stats.cpu}%`;
        }
        updateProgressBar(cpuBar, stats.cpu);
    }

    // Memory
    if (memVal && memBar) {
        const currentMem = parseFloat(memVal.textContent) || 0;
        if (Math.abs(currentMem - stats.mem.percentage) > 0.5) {
            memVal.textContent = `${stats.mem.percentage}%`;
        }
        updateProgressBar(memBar, stats.mem.percentage);
    }

    // Disk
    if (stats.disk && stats.disk.length > 0) {
        const rootDisk = stats.disk[0];
        if (diskVal && diskBar) {
            const currentDisk = parseFloat(diskVal.textContent) || 0;
            if (Math.abs(currentDisk - rootDisk.percentage) > 0.5) {
                diskVal.textContent = `${rootDisk.percentage}%`;
            }
            updateProgressBar(diskBar, rootDisk.percentage);
        }
    }

    // Network Stats
    if (stats.network) {
        const rx = formatSpeed(stats.network.speed.rx);
        const tx = formatSpeed(stats.network.speed.tx);

        if (netSpeedDown) netSpeedDown.textContent = rx;
        if (netSpeedUp) netSpeedUp.textContent = tx;

        const todayTotal = formatBytes(stats.network.bandwidth.today.total);
        if (bwTodayVal) bwTodayVal.textContent = todayTotal;

        const monthTotal = formatBytes(stats.network.bandwidth.month.total);
        if (bwMonthVal) bwMonthVal.textContent = monthTotal;
    }
});

// Log Handling
socket.on('new_domain', (domain) => {
    if (!domains.has(domain)) {
        domains.add(domain);
        renderDomainList();
        showToast(`New domain detected: ${domain}`, 'info');
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

// Empty State Management
function showEmptyState() {
    const emptyState = logsContainer.querySelector('.empty-state');
    if (emptyState) {
        emptyState.style.display = 'flex';
    }
}

function hideEmptyState() {
    const emptyState = logsContainer.querySelector('.empty-state');
    if (emptyState) {
        emptyState.style.display = 'none';
    }
}

// UI Functions
function renderDomainList() {
    // Hide skeleton
    const skeleton = document.querySelector('.domain-skeleton');
    if (skeleton) skeleton.style.display = 'none';

    domainListEl.innerHTML = '';
    
    if (domains.size === 0) {
        domainListEl.innerHTML = '<p class="text-secondary text-center small px-3 py-4 mb-0">No domains yet</p>';
        if (domainCountEl) domainCountEl.textContent = '0';
        return;
    }

    if (domainCountEl) domainCountEl.textContent = domains.size;

    domains.forEach(domain => {
        const button = document.createElement('button');
        button.className = `list-group-item list-group-item-action domain-item bg-transparent border-0 ${domain === currentDomain ? 'active' : ''}`;
        button.textContent = domain;
        button.onclick = () => switchDomain(domain);
        
        // Add animation delay for staggered effect
        button.style.animation = 'fadeIn 0.3s ease-out';
        
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
    
    // Show loading skeleton
    logsContainer.innerHTML = `
        <div class="skeleton-item"></div>
        <div class="skeleton-item"></div>
        <div class="skeleton-item"></div>
    `;
    
    renderDomainList(); // Update active state

    // Close mobile sidebar if open
    const sidebarMenu = document.getElementById('sidebarMenu');
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebarMenu);
    if (bsOffcanvas) {
        bsOffcanvas.hide();
    }

    socket.emit('join_room', `logs:${domain}`);
    socket.emit('fetch_history', domain);
    
    showToast(`Switched to ${domain}`, 'success');
    
    // Clear skeleton after a short delay
    setTimeout(() => {
        const skeletons = logsContainer.querySelectorAll('.skeleton-item');
        skeletons.forEach(s => s.remove());
    }, 500);
}

function appendLog(entry) {
    hideEmptyState();
    
    const div = document.createElement('div');

    const status = entry.status || '-';
    let statusClass = '';
    if (status >= 500) statusClass = 'status-5xx';
    else if (status >= 400) statusClass = 'status-4xx';
    else if (status >= 200) statusClass = 'status-2xx';

    const ts = new Date(entry.ts * 1000).toLocaleTimeString();
    const method = entry.request?.method || '-';
    const uri = entry.request?.uri || '-';

    div.className = `log-card ${statusClass}`;

    // Status badge color
    let statusBadgeClass = 'bg-secondary';
    if (status >= 500) statusBadgeClass = 'bg-danger';
    else if (status >= 400) statusBadgeClass = 'bg-warning';
    else if (status >= 200) statusBadgeClass = 'bg-success';

    div.innerHTML = `
        <div class="text-secondary font-monospace small" style="min-width: 85px;">${ts}</div>
        <div class="method-badge method-${method}">${method}</div>
        <div class="log-uri text-truncate flex-grow-1" title="${uri}">${uri}</div>
        <div class="badge ${statusBadgeClass} font-monospace px-2 py-1">${status}</div>
        <button class="btn btn-sm btn-link text-secondary p-0 view-btn" aria-label="View details">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        </button>
    `;

    // Add click handler for view button
    const viewBtn = div.querySelector('.view-btn');
    viewBtn.onclick = (e) => {
        e.stopPropagation();
        openModal(entry);
    };

    // Make the whole card clickable
    div.onclick = () => openModal(entry);

    logsContainer.insertBefore(div, logsContainer.firstChild);

    // Enforce max logs limit
    while (logsContainer.children.length > maxLogs) {
        const lastChild = logsContainer.lastChild;
        if (lastChild && !lastChild.classList.contains('empty-state')) {
            logsContainer.removeChild(lastChild);
        } else {
            break;
        }
    }
    
    // Show empty state if no logs
    if (logsContainer.children.length === 0 || (logsContainer.children.length === 1 && logsContainer.querySelector('.empty-state'))) {
        showEmptyState();
    }
}

function openModal(entry) {
    const ts = new Date(entry.ts * 1000).toLocaleString();
    const duration = entry.duration ? (entry.duration * 1000).toFixed(2) + ' ms' : '0 ms';

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
    const logCards = logsContainer.querySelectorAll('.log-card');
    
    if (logCards.length === 0) {
        showToast('No logs to clear', 'info');
        return;
    }

    // Animate removal
    logCards.forEach((card, index) => {
        setTimeout(() => {
            card.style.animation = 'slideInRight 0.2s ease-out reverse';
            setTimeout(() => card.remove(), 200);
        }, index * 30);
    });

    setTimeout(() => {
        logsContainer.innerHTML = '<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg><p class="empty-state-text">No logs yet</p><p class="empty-state-subtext">Logs will appear here as requests come in</p></div>';
        showEmptyState();
    }, logCards.length * 30 + 200);

    showToast('Logs cleared', 'success');
};

logoutBtn.onclick = async () => {
    logoutBtn.disabled = true;
    logoutBtn.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Logging out...
    `;
    
    try {
        await fetch('/api/logout', { method: 'POST' });
        showToast('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = '/login';
        }, 500);
    } catch (err) {
        console.error(err);
        showToast('Error logging out', 'error');
        logoutBtn.disabled = false;
        logoutBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
        `;
    }
};

maxLogsSelect.onchange = (e) => {
    maxLogs = parseInt(e.target.value);
    showToast(`Display limit: ${maxLogs} logs`, 'info');
    
    if (currentDomain) {
        logsContainer.innerHTML = '';
        showEmptyState();
        socket.emit('fetch_history', currentDomain);
    }
};

// Connection Status
socket.on('connect', () => {
    console.log('Connected to server');
    showToast('Connected to monitoring server', 'success');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showToast('Disconnected from server', 'error');
});

socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
    if (err.message === 'Unauthorized') {
        showToast('Session expired. Redirecting to login...', 'error');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    } else {
        showToast('Connection error. Retrying...', 'error');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        maxLogsSelect.focus();
    }
    
    // Escape to close modal
    if (e.key === 'Escape' && logModal) {
        logModal.hide();
    }
});

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
