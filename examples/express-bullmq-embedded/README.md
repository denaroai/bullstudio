# Express BullMQ Embedded Example

This example mounts Bullstudio inside an Express application at
`/ops/bullstudio`.

## Run It

Start Redis:

```bash
docker compose -f docker-compose.test.yml up -d redis
```

Start the Express app:

```bash
pnpm --filter @bullstudio/example-express-bullmq-embedded dev
```

The dashboard is mounted at:

```text
http://localhost:3000/ops/bullstudio
```

Default dashboard credentials:

```text
operator / change-me
```

Set `REDIS_URL`, `PORT`, `BULLSTUDIO_USERNAME`, or `BULLSTUDIO_PASSWORD` to
override the defaults.
