# NestJS BullMQ embedded example

Runs Bullstudio inside a NestJS application with either the Express or Fastify
platform adapter.

```sh
pnpm --filter @bullstudio/example-nestjs-bullmq-embedded dev:express
```

or:

```sh
pnpm --filter @bullstudio/example-nestjs-bullmq-embedded dev:fastify
```

Open `http://localhost:3000/ops/bullstudio`.

Set `REDIS_URL`, `BULLSTUDIO_USERNAME`, and `BULLSTUDIO_PASSWORD` to point the
example at your local Redis and change the default dashboard credentials.
