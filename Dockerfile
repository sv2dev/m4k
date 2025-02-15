FROM oven/bun:1.2.2-slim AS build
WORKDIR /app
COPY . .
RUN bun install && bun run build

FROM oven/bun:1.2.2-slim AS install
ENV NODE_ENV=production
WORKDIR /app
COPY ./package.json bun.lock /app/
RUN bun install --production

FROM oven/bun:1.2.2-slim AS prod
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    FFMPEG_PATH=/usr/local/bin/ffmpeg
WORKDIR /app
COPY --from=mwader/static-ffmpeg:7.1 /ffmpeg /usr/local/bin/
COPY --from=mwader/static-ffmpeg:7.1 /ffprobe /usr/local/bin/
COPY --from=build /app/dist/ /app
COPY --from=install /app/ /app
EXPOSE 3000
CMD ["bun", "app.js"]
