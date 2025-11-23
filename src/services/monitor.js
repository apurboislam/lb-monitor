const si = require('systeminformation');

let io;

const init = (socketIo) => {
    io = socketIo;
    startMonitoring();
};

const startMonitoring = () => {
    setInterval(async () => {
        try {
            const [cpu, mem, disk] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.fsSize()
            ]);

            const stats = {
                cpu: Math.round(cpu.currentLoad),
                mem: {
                    total: mem.total,
                    used: mem.active,
                    percentage: Math.round((mem.active / mem.total) * 100)
                },
                disk: disk.map(d => ({
                    fs: d.fs,
                    mount: d.mount,
                    size: d.size,
                    used: d.used,
                    percentage: Math.round(d.use)
                }))
            };

            if (io) {
                io.emit('stats', stats);
            }
        } catch (error) {
            console.error('Error fetching system stats:', error);
        }
    }, 2000);
};

module.exports = { init };
