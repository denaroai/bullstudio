<p align="center">
  <img src="assets/logo.svg" alt="bullstudio" width="120" />
</p>

<h1 align="center">bullstudio</h1>

<p align="center">
  A lightweight, beautiful queue management dashboard for <a href="https://github.com/OptimalBits/bull">Bull</a> and <a href="https://docs.bullmq.io/">BullMQ</a>.<br/>
  Monitor your queues, inspect jobs, visualize flows, and manage your Redis-backed job infrastructure.
</p>

<p align="center">
  <a href="https://hub.docker.com/r/emirce/bullstudio"><img src="https://img.shields.io/docker/v/emirce/bullstudio?sort=semver&label=Docker%20Hub" alt="Docker Hub" /></a>
  <a href="https://hub.docker.com/r/emirce/bullstudio"><img src="https://img.shields.io/docker/pulls/emirce/bullstudio" alt="Docker Pulls" /></a>
  <img src="https://img.shields.io/badge/BullMQ-5.x-orange" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Bullx-4.x-orange" alt="Bull" />
  <img src="https://img.shields.io/badge/React-19-blue" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue" alt="TypeScript" />
</p>

---


<div align="center">
<img width="80%" src="https://github.com/user-attachments/assets/b5eea348-5919-40ff-ad55-3a0387dbec47" />
</div>


## Quick Start

```bash
npx bullstudio -r <redis_url>
```

That's it! The dashboard opens automatically at [http://localhost:4000](http://localhost:4000). No code integration needed. Bullstudio automatically detects your provider (Bull or BullMq).

---

## Installation

### Run directly with npx (recommended)

```bash
npx bullstudio
```

### Or install globally

```bash
npm install -g bullstudio
bullstudio
```

---

## Docker

### Quick Start

```bash
docker run -d \
  -p 4000:4000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  emirce/bullstudio
```

The dashboard is available at [http://localhost:4000](http://localhost:4000).

### Connect to Redis

```bash
# Local Redis (Docker for Mac/Windows)
docker run -d -p 4000:4000 -e REDIS_URL=redis://host.docker.internal:6379 emirce/bullstudio

# Remote Redis
docker run -d -p 4000:4000 -e REDIS_URL=redis://myhost.com:6379 emirce/bullstudio

# Redis with authentication
docker run -d -p 4000:4000 -e REDIS_URL=redis://:yourpassword@myhost.com:6379 emirce/bullstudio
```

### Custom Port

```bash
docker run -d -p 8080:8080 -e PORT=8080 -e REDIS_URL=redis://host.docker.internal:6379 emirce/bullstudio
```

### With Authentication

```bash
docker run -d \
  -p 4000:4000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e BULLSTUDIO_PASSWORD=secret123 \
  emirce/bullstudio
```

### Docker Compose

```yaml
services:
  bullstudio:
    image: emirce/bullstudio
    ports:
      - "4000:4000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

```bash
docker compose up -d
```

### Environment Variables

| Variable              | Description                               | Default                  |
| --------------------- | ----------------------------------------- | ------------------------ |
| `REDIS_URL`           | Redis connection URL                      | `redis://localhost:6379` |
| `PORT`                | Port to run the dashboard on              | `4000`                   |
| `BULLSTUDIO_USERNAME` | Password for HTTP Basic Auth (production) | `bullstudio`             |
| `BULLSTUDIO_PASSWORD` | Password for HTTP Basic Auth (production) | (none)                   |

### Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest build from the `main` branch |
| `x.y.z` | Specific release version (e.g., `0.1.4`) |
| `x.y` | Minor version (e.g., `0.1`) |
| `x` | Major version (e.g., `0`) |

### Supported Platforms

- `linux/amd64`
- `linux/arm64`

---

## Usage

```bash
bullstudio [options]
```

### Options

| Option              | Short | Description                                    | Default                  |
| ------------------- | ----- | ---------------------------------------------- | ------------------------ |
| `--redis <url>`     | `-r`  | Redis connection URL                           | `redis://localhost:6379` |
| `--port <port>`     | `-p`  | Port to run the dashboard on                   | `4000`                   |
| `--username <user>` |       | Username for HTTP Basic Auth (production only) | `bullstudio`             |
| `--password <pass>` |       | Password for HTTP Basic Auth (production only) | (none)                   |
| `--no-open`         |       | Don't open browser automatically               | Opens browser            |
| `--help`            | `-h`  | Show help message                              |                          |

---

## Examples

### Connect to local Redis

```bash
bullstudio
```

### Connect to a remote Redis server

```bash
bullstudio -r redis://myhost.com:6379
```

### Connect with authentication

```bash
bullstudio -r redis://:yourpassword@myhost.com:6379
```

### Use a custom port

```bash
bullstudio -p 5000
```

### Connect to Redis with username and password

```bash
bullstudio -r redis://username:password@myhost.com:6379
```

### Run without opening browser

```bash
bullstudio --no-open
```

### Combine options

```bash
bullstudio -r redis://:secret@production.redis.io:6379 -p 8080 --no-open
```

### Protect dashboard with password

```bash
bullstudio --password secret123
```

The browser will prompt for credentials:

- Username: `bullstudio`
- Password: `secret123`

---

## Authentication

You can protect the dashboard with HTTP Basic Auth in **production mode only**. Development mode (`--dev`) does not require authentication.

### Usage

```bash
# Using CLI flag
bullstudio --password secret123

## Custom username
bullstudio --username bullstudio_admin --password secret123

# Using environment variable
BULLSTUDIO_PASSWORD=secret123 bullstudio

# Docker with authentication
docker run -e BULLSTUDIO_PASSWORD=secret123 -p 4000:4000 emirce/bullstudio
```

### Authentication Details

- **Username**: `bullstudio` (fixed, cannot be changed)
- **Password**: Set via `--password` flag or `BULLSTUDIO_PASSWORD` environment variable
- **Mode**: Only applies to production mode (default). Development mode (`--dev`) bypasses authentication
- **Method**: HTTP Basic Auth (browser will show native login dialog)

### Health Check

The `/health` endpoint is publicly accessible without authentication:

```bash
curl http://localhost:4000/health
# {"status":"ok","timestamp":"2026-02-08T21:58:47.508Z","redis":"configured"}
```

---

## Features

### Overview Dashboard
Get a bird's-eye view of your queue health with real-time metrics, throughput charts, and failure tracking.

### Jobs Browser
- Browse all jobs across queues
- Filter by status (waiting, active, completed, failed, delayed)
- Search jobs by name, ID, or data
- Retry failed jobs with one click
- View detailed job data, return values, and stack traces

### Flows Visualization
- Visualize parent-child job relationships as interactive graphs
- See the live state of each job in the flow
- Click nodes to navigate to job details
- Auto-refresh while flows are active

---

## Requirements

- **Node.js** 18 or higher
- **Redis** server running (local or remote)
- **BullMQ** queues in your Redis instance

---

## Environment Variables

You can also configure bullstudio using environment variables:

```bash
export REDIS_URL=redis://localhost:6379
export PORT=4000
export BULLSTUDIO_USERNAME=bullstudio
export BULLSTUDIO_PASSWORD=secret123
bullstudio
```

| Variable              | Description                                    | Default                  |
| --------------------- | ---------------------------------------------- | ------------------------ |
| `REDIS_URL`           | Redis connection URL                           | `redis://localhost:6379` |
| `PORT`                | Port to run the dashboard on                   | `4000`                   |
| `BULLSTUDIO_USERNAME` | Username for HTTP Basic Auth (production only) | `bullstudio`             |
| `BULLSTUDIO_PASSWORD` | Password for HTTP Basic Auth (production only) | (none)                   |

Command-line options take precedence over environment variables.

---

## Troubleshooting

### "Connection refused" error

Make sure Redis is running:

```bash
# Check if Redis is running
redis-cli ping

# Start Redis (macOS with Homebrew)
brew services start redis

# Start Redis (Docker)
docker run -d -p 6379:6379 redis
```

### No queues showing up

bullstudio discovers queues by scanning for BullMQ metadata keys in Redis. Make sure:
1. Your application has created at least one queue
2. You're connecting to the correct Redis instance
3. If using a prefix other than `bull`, your queues use the default prefix

### Port already in use

Use a different port:

```bash
bullstudio -p 5000
```

---

## License

MIT

---

<p align="center">
  Made with love for the BullMQ community
</p>
