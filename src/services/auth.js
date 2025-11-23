const speakeasy = require('speakeasy');
const config = require('../config');

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        return next();
    }
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.redirect('/login');
};

// Verify TOTP Token
const verifyToken = (token) => {
    if (!config.TOTP_SECRET) {
        console.error('TOTP_SECRET is not set!');
        return false;
    }
    return speakeasy.totp.verify({
        secret: config.TOTP_SECRET,
        encoding: 'base32',
        token: token,
        window: 1 // Allow 30s skew
    });
};

module.exports = {
    requireAuth,
    verifyToken
};
