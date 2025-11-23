const express = require('express');
const path = require('path');
const router = express.Router();
const authService = require('../services/auth');

// Serve Login Page
router.get('/login', (req, res) => {
    if (req.session.authenticated) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, '../../public/login.html'));
});

// Serve Dashboard (Protected)
router.get('/', authService.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

module.exports = router;
