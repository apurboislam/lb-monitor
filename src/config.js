require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    TOTP_SECRET: process.env.TOTP_SECRET,
    SESSION_SECRET: process.env.SESSION_SECRET || 'super-secret-session-key-change-me',
    LOG_DIR: process.env.LOG_DIR || '/opt/caddy/logs',
    NODE_ENV: process.env.NODE_ENV || 'development',
    PANEL_NAME: process.env.PANEL_NAME || 'APS LB'
};
