FROM oven/bun:1.2.0-slim AS build
WORKDIR /app
COPY . .
RUN bun install && bun test && bun run build

FROM oven/bun:1.2.0-slim AS install
ENV NODE_ENV=production
WORKDIR /app
COPY ./package.json bun.lock /app/
RUN bun install --production

FROM oven/bun:1.2.0-slim AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist/ /app
COPY --from=install /app/ /app
EXPOSE 3000
CMD ["bun", "app.js"]
