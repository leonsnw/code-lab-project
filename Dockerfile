# CodeLab: API + frontend estático + juiz (bubblewrap, gcc, python3).
# O juiz cria namespaces sem privilégio: o contêiner precisa das opções de
# segurança de compose.prod.yaml (veja docs/deploy.md).

FROM node:24-bookworm-slim AS build
# O Prisma detecta a versão do OpenSSL para baixar os engines certos.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci
COPY apps/api apps/api
RUN npm run db:generate && npm run build

FROM node:24-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap gcc libc6-dev python3 util-linux ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app /app
COPY --chown=node:node apps/web apps/web
USER node
ENV NODE_ENV=production \
    PORT=3333 \
    JUDGE_CONCURRENCY=4 \
    CHECKPOINT_DISABLE=1 \
    HOME=/tmp \
    PRISMA_HIDE_UPDATE_MESSAGE=1
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3333/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# Aplica as migrations pendentes e sobe a API.
# (o Prisma fica em apps/api/node_modules: o npm não o eleva para a raiz)
CMD ["sh", "-c", "apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]
