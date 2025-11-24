# LB Monitor

**LB Monitor** is a lightweight, real-time monitoring solution for Linux VPS environments running Caddy. It provides a secure, web-based dashboard to visualize system statistics (CPU, RAM, Disk, Network) and stream Caddy logs in real-time.

## Features

- **Real-time System Stats**: Monitor CPU usage, Memory consumption, Disk I/O, and Network traffic live.
- **Live Log Streaming**: Stream Caddy access logs directly to your browser via WebSockets.
- **Secure Authentication**: Protected by TOTP (Time-based One-Time Password) 2FA.
- **Responsive Dashboard**: Clean and modern UI for easy monitoring on desktop and mobile.
- **Docker Ready**: Includes Dockerfile and Docker Compose configuration for easy deployment.
- **Rate Limiting**: Built-in protection against brute-force login attempts.

## Tech Stack

- **Backend**: Node.js, Express
- **Real-time**: Socket.IO
- **System Stats**: systeminformation
- **Authentication**: Speakeasy (TOTP), Express Session
- **Frontend**: HTML5, CSS3, JavaScript (served statically)

## Prerequisites

- **Node.js**: v14 or higher
- **Caddy**: The application is designed to monitor Caddy logs.
- **vnstat**: Required for network traffic monitoring (database mapped into container).
- **NPM**: Node Package Manager

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/apurboislam/lb-monitor.git
    cd lb-monitor
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configuration:**
    Create a `.env` file in the root directory with the following variables:

    ```env
    PORT=3000
    NODE_ENV=development
    # Secret key for session encryption (generate a random string)
    SESSION_SECRET=your_super_secret_session_key
    # Secret key for TOTP (Base32 string)
    TOTP_SECRET=YOUR_BASE32_TOTP_SECRET
    # Path to your Caddy logs directory
    LOG_DIR=/opt/caddy/logs
    ```

    > **Note:** You can generate a `TOTP_SECRET` using an online tool or a script. This secret is used to generate the 2FA codes in your authenticator app (e.g., Google Authenticator, Authy).

## Usage

### Running Locally

Since the main entry point is `src/server.js`, you can start the application using:

```bash
node src/server.js
```

The application will be available at `http://localhost:3000`.

### Running with Docker

The Docker configuration uses `network_mode: host` to allow the application to accurately monitor the host's network interfaces. It also mounts `/var/lib/vnstat` to read network statistics.

1.  **Prerequisites:**
    Ensure `vnstat` is installed and running on the host machine, as the container relies on the host's `vnstat` database.

2.  **Build and Run:**
    ```bash
    docker compose up -d --build
    ```

3.  **Stop:**
    ```bash
    docker compose down
    # Remove volumes
    docker compose down -v
    ```

## API Endpoints

The application exposes a few API endpoints for authentication:

-   **POST** `/api/login`
    -   **Body**: `{ "token": "123456" }`
    -   **Description**: Authenticate using a TOTP token.
-   **POST** `/api/logout`
    -   **Description**: Destroy the current session.

## Project Structure

```
lb-monitor/
├── src/
│   ├── config.js         # Configuration loader
│   ├── server.js         # Application entry point
│   ├── routes/           # Express routes (API & Views)
│   ├── services/         # Core logic (Auth, Logs, Monitor)
│   └── utils/            # Helper functions
├── public/               # Static frontend assets
├── Dockerfile            # Docker build instructions
├── docker-compose.yml    # Docker Compose config
└── package.json          # Dependencies and scripts
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.
