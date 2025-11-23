const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const path = require('path');
const config = require('./config');

const authService = require('./services/auth');
const monitorService = require('./services/monitor');
const logsService = require('./services/logs');

const apiRoutes = require('./routes/api');
const viewRoutes = require('./routes/view');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Session Setup
const sessionMiddleware = session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 10 * 60 * 1000 } // 10 minutes
});

app.use(sessionMiddleware);

// Share session with Socket.IO
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// Socket.IO Auth Middleware
io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.authenticated) {
        next();
    } else {
        next(new Error('Unauthorized'));
    }
});

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('join_room', (room) => {
        socket.join(room);
    });

    socket.on('leave_room', (room) => {
        socket.leave(room);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Routes
app.use('/api', apiRoutes);
app.use('/', viewRoutes);

// Initialize Services
monitorService.init(io);
logsService.init(io);

// Start Server
server.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
});
