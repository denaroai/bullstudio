# Next.js BullMQ Embedded Example

This example mounts Bullstudio inside a real Next.js App Router application at
`/ops/bullstudio`.

## Run It

Start Redis:

```bash
docker compose -f docker-compose.test.yml up -d redis
```

Start the Next.js app:

```bash
pnpm --filter @bullstudio/example-next-bullmq-embedded dev
```

Open the host app:

```text
http://localhost:3000
```

The dashboard is mounted at:

```text
http://localhost:3000/ops/bullstudio
```

Default dashboard credentials:

```text
operator / change-me
```

Set `REDIS_URL`, `BULLSTUDIO_USERNAME`, or `BULLSTUDIO_PASSWORD` to override the
defaults.
