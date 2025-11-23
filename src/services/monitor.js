const si = require('systeminformation');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

let io;

const init = (socketIo) => {
    io = socketIo;
    startMonitoring();
};

const getNetworkStats = async () => {
    try {
        // Live Network Speed
        const networkStats = await si.networkStats('eth0');
        const rx_sec = networkStats[0]?.rx_sec || 0; // Bytes per second
        const tx_sec = networkStats[0]?.tx_sec || 0; // Bytes per second

        // Bandwidth Usage (vnstat)
        let bandwidth = {
            today: { rx: 0, tx: 0, total: 0 },
            month: { rx: 0, tx: 0, total: 0 }
        };

        try {
            const { stdout } = await execAsync('vnstat --json');
            const data = JSON.parse(stdout);
            const iface = data.interfaces.find(i => i.name === 'eth0' || i.alias === 'eth0');

            if (iface) {
                // Today
                const today = new Date();
                const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                const dayData = iface.traffic.day.find(d => d.date.year === today.getFullYear() && d.date.month === today.getMonth() + 1 && d.date.day === today.getDate());
                if (dayData) {
                    bandwidth.today = { rx: dayData.rx, tx: dayData.tx, total: dayData.rx + dayData.tx };
                }

                // Month
                const monthData = iface.traffic.month.find(m => m.date.year === today.getFullYear() && m.date.month === today.getMonth() + 1);
                if (monthData) {
                    bandwidth.month = { rx: monthData.rx, tx: monthData.tx, total: monthData.rx + monthData.tx };
                }
            }
        } catch (e) {
            console.error('Error fetching vnstat data:', e.message);
        }

        return {
            speed: { rx: rx_sec, tx: tx_sec },
            bandwidth
        };
    } catch (e) {
        console.error('Error fetching network stats:', e);
        return null;
    }
};

const startMonitoring = () => {
    setInterval(async () => {
        try {
            const [cpu, mem, disk, network] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.fsSize(),
                getNetworkStats()
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
