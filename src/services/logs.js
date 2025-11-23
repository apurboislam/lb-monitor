const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let io;
const fileOffsets = {};
const domains = new Set();

const domainFiles = {}; // domain -> filePath

const init = (socketIo) => {
    io = socketIo;

    console.log(`Initializing Log Service. Watching directory: ${config.LOG_DIR}`);

    // Initial scan to populate domains and debug visibility
    try {
        if (fs.existsSync(config.LOG_DIR)) {
            const files = fs.readdirSync(config.LOG_DIR);
            console.log(`Found ${files.length} files in ${config.LOG_DIR}:`, files);
            files.forEach(file => {
                if (file.endsWith('.log')) {
                    const domain = file.replace('.log', '');
                    domains.add(domain);
                    domainFiles[domain] = path.join(config.LOG_DIR, file);
                    console.log(`Discovered domain: ${domain}`);
                }
            });
        } else {
            console.error(`Log directory does not exist: ${config.LOG_DIR}`);
        }
    } catch (err) {
        console.error(`Error scanning log directory:`, err);
    }

    io.on('connection', (socket) => {
        domains.forEach(domain => {
            socket.emit('new_domain', domain);
        });

        socket.on('fetch_history', (domain) => {
            const filePath = domainFiles[domain];
            if (filePath && fs.existsSync(filePath)) {
                console.log(`Fetching history for ${domain} from ${filePath}`);
                readTailAndEmit(socket, filePath, domain);
            }
        });
    });

    startWatching();
};

const readTailAndEmit = (socket, filePath, domain) => {
    const stats = fs.statSync(filePath);
    // Increase tail size to ~500KB to support higher log limits (e.g. 1000 logs)
    const TAIL_SIZE = 500 * 1024;
    const start = Math.max(0, stats.size - TAIL_SIZE);

    const stream = fs.createReadStream(filePath, {
        start: start,
        end: stats.size
    });

    let buffer = '';
    stream.on('data', (chunk) => {
        buffer += chunk;
    });

    stream.on('end', () => {
        const lines = buffer.split('\n');
        lines.forEach(line => {
            if (!line.trim()) return;
            try {
                const logEntry = JSON.parse(line);
                socket.emit('log', { domain, entry: logEntry });
            } catch (e) {
                // Ignore parse errors for history
            }
        });
    });
};

const startWatching = () => {
    const watcher = chokidar.watch(path.join(config.LOG_DIR, '*.log'), {
        persistent: true,
        ignoreInitial: false, // We want to know about existing files to set offsets
        usePolling: true, // Often needed for Docker mounted volumes
        interval: 1000
    });

    watcher
        .on('add', filePath => {
            const stats = fs.statSync(filePath);
            fileOffsets[filePath] = stats.size; // Start at end for new lines

            console.log(`Watching log file: ${filePath}`);

            const domain = path.basename(filePath).replace('.log', '');
            domainFiles[domain] = filePath;

            if (!domains.has(domain)) {
                domains.add(domain);
                if (io) io.emit('new_domain', domain);
            }
        })
        .on('change', filePath => {
            readNewLines(filePath);
        });

    // Manual Polling Fallback
    // Chokidar can be unreliable with mounted volumes on some systems.
    // We manually check file sizes every second to ensure we don't miss updates.
    setInterval(() => {
        Object.keys(domainFiles).forEach(domain => {
            const filePath = domainFiles[domain];
            readNewLines(filePath);
        });
    }, 1000);
};

const readNewLines = (filePath) => {
    const currentOffset = fileOffsets[filePath] || 0;
    // Check if file still exists
    if (!fs.existsSync(filePath)) return;

    const stats = fs.statSync(filePath);
    const newSize = stats.size;

    // console.log(`[DEBUG] Check ${filePath}: Old=${currentOffset}, New=${newSize}`);

    if (newSize < currentOffset) {
        // File was rotated/truncated
        console.log(`[INFO] File truncated: ${filePath}. Resetting offset.`);
        fileOffsets[filePath] = 0;
        return;
    }

    if (newSize === currentOffset) return;

    console.log(`[INFO] Reading new content from ${filePath}: ${currentOffset} -> ${newSize}`);

    const stream = fs.createReadStream(filePath, {
        start: currentOffset,
        end: newSize - 1,
        encoding: 'utf8'
    });

    let buffer = '';
    stream.on('data', (chunk) => {
        buffer += chunk;
    });

    stream.on('end', () => {
        fileOffsets[filePath] = newSize;
        const lines = buffer.split('\n');
        lines.forEach(line => {
            if (!line.trim()) return;
            try {
                const logEntry = JSON.parse(line);
                const domain = path.basename(filePath).replace('.log', '');

                // Emit to general room and specific domain room
                if (io) {
                    io.to(`logs:${domain}`).emit('log', { domain, entry: logEntry });
                    io.emit('log_all', { domain, entry: logEntry });
                }
            } catch (e) {
                // Only log error if it's not a partial line from tailing
                // and if it looks like a substantial line
                if (line.length > 10) {
                    console.error(`Failed to parse JSON line in ${filePath}:`, e.message);
                }
            }
        });
    });

    stream.on('error', (err) => {
        console.error(`Error reading file ${filePath}:`, err);
    });
};

module.exports = { init };
