# m4k - media toolkit

A Bun media optimizer based on [ffmpeg](https://ffmpeg.org/) and [sharp](https://sharp.pixelplumbing.com/)/[libvips](https://github.com/libvips/libvips).

The docker image is available at [ghcr.io/sv2dev/media-optimizer](https://github.com/sv2dev/media-optimizer/pkgs/container/media-optimizer). It uses Bun as runtime.

## Usage

### Running the server

The [`@m4k/server`](./packages/server) can be deployed as a docker container.

```bash
docker run -p 3000:3000 -v $(pwd)/output:/output ghcr.io/sv2dev/m4k:0.2.1
```

Alternatively, you can install the server as a local package and run it:

```bash
bun add @m4k/server
```

Note: This server implementation is using Bun as runtime, so it can only be run on a system that has Bun installed.

Then, run the server:

```bash
bun run @m4k/server
```

Or import the server as a module and embed it in your project:

```ts
import { serveOpts } from "@m4k/server";

Bun.serve(serveOpts);
```

### Using the client

The client is available as a standalone package [@m4k/client](./packages/client). You can use it to connect to the m4k server.

Example, using the client on Bun:

```ts
import { ProcessedFile, processVideo } from "@m4k/client";

for await (const value of processVideo(
  "http://localhost:3000",
  Bun.file("fixtures/video.mp4"),
  { format: "mp4", videoCodec: "libx265", output: "output/video.mp4" }
)) {
  if (value instanceof ProcessedFile) {
    // handle the processed file
  } else {
    // handle the status update
  }
}
```
