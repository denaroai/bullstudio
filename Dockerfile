FROM node:24-alpine AS base
RUN apk update
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
WORKDIR /app

# BUILDER STAGE
FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter bullstudio build

# RUNNER STAGE
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 bullstudio
USER bullstudio

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=builder --chown=bullstudio:nodejs /app/packages/cli/dist/ ./packages/cli/dist/
COPY --from=builder --chown=bullstudio:nodejs /app/node_modules/ ./node_modules/
COPY --from=builder --chown=bullstudio:nodejs /app/packages/cli/node_modules/ ./packages/cli/node_modules/

ARG PORT=4000

EXPOSE ${PORT}
ENV PORT=${PORT}

ENV BULLSTUDIO_CLIENT_DIR=/app/packages/cli/dist/client

CMD ["node", "./packages/cli/dist/server/production.js"]
