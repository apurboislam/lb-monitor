const express = require('express');
const router = express.Router();
const authService = require('../services/auth');

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

router.post('/login', (req, res) => {
    const ip = req.ip;
    const now = Date.now();

    if (loginAttempts.has(ip)) {
        const attempt = loginAttempts.get(ip);
        if (attempt.count >= MAX_ATTEMPTS) {
            if (now - attempt.firstAttempt < LOCKOUT_TIME) {
                return res.status(429).json({ error: 'Too many failed attempts. Please try again later.' });
            } else {
                loginAttempts.delete(ip); // Reset after lockout
            }
        }
    }

    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ error: 'Token is required' });
    }

    const verified = authService.verifyToken(token);
    if (verified) {
        loginAttempts.delete(ip); // Reset on success
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        // Record failed attempt
        if (!loginAttempts.has(ip)) {
            loginAttempts.set(ip, { count: 1, firstAttempt: now });
        } else {
            const attempt = loginAttempts.get(ip);
            attempt.count++;
            // If lockout expired but count wasn't reset (edge case), reset time
            if (now - attempt.firstAttempt > LOCKOUT_TIME) {
                attempt.firstAttempt = now;
                attempt.count = 1;
            }
        }
        res.status(401).json({ error: 'Invalid token' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

router.get('/config', (req, res) => {
    res.json({ panelName: require('../config').PANEL_NAME });
});

module.exports = router;
