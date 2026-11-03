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

### Image classification and embedded previews

The optional classification API runs a pinned CPU CLIP model on the M4K host. `GET /info`
advertises `clip-image-labels` version `1` and `embedded-preview/1`. Existing conversion behaviour
is unchanged unless the new options/endpoints are selected. These changes require deploying this
server version, not just upgrading a client.

```ts
import { classifyImage } from "@m4k/client";

const result = await classifyImage("http://localhost:3000", Bun.file("preview.jpg"), {
  classifierId: "clip-image-labels",
  classifierVersion: "1",
  labels: ["landscape", "receipt", "family photo"],
});
```

`POST /images/classify` uploads the selected representation with JSON `X-Options`. It returns
classifier/version, the uploaded bytes' SHA-256 and every candidate's score. Labels are a complete
ordered candidate set (2–32 distinct labels, 1–80 characters each). Scores are softmax rankings
within that set, not independent probabilities; changing the candidates changes their meaning.
The fixed model is `Xenova/clip-vit-base-patch32` revision
`6b7c523703ae26e39be4b03774966f8571c7f523` (MIT), Transformers.js 3.8.1, CPU/q8,
with prompt `This is a photo of {}`. Changing this profile requires a new classifier version.
Only static JPEG/PNG/WebP previews up to 8 MiB / 1,048,576 pixels are accepted.
One inference runs per process; busy requests receive 429. Cancellation discards results without
freeing the slot before native inference finishes. There is no model, original or cloud fallback.

The model is downloaded on first use and remains in memory. `M4K_MODEL_CACHE` selects the persistent
model-cache directory (default `${M4K_TMP_DIR:-/tmp/m4k}/models`); ensure the service user can write it.
Mount that directory to retain weights across container replacements. Model downloads do not
upload input media. The quantized model cache is approximately 149 MiB in the tested configuration;
this is not a runtime memory limit. CPU ONNX binaries are packaged by the dependency; optional CUDA
postinstall/downloads are not required. The server bundle keeps Transformers.js external so native
runtime assets resolve from installed dependencies.

For RAW classification preparation, `processImage(..., { embeddedPreview: true, format: "jpeg" })`
uses only a TIFF IFD1 JPEG thumbnail, never full RAW development. Input is limited to 128 MiB,
each of IFD0/IFD1 to 256 entries, and the JPEG to 8 MiB / 1,048,576 pixels. Both TIFF byte orders
are supported; missing/malformed thumbnails fail without developing or passing through the source.
Source orientation is applied by normal conversion; metadata preservation options are forbidden
in this mode. Callers must require `embedded-preview/1` before uploading to avoid older servers
silently ignoring the option. No broad camera-format or physical-device compatibility is claimed;
extractor tests use synthetic TIFF/DNG containers.

### Using the client

The client is available as a standalone package [@m4k/client](./packages/client). You can use it to connect to the m4k server.

Example, using the client on Bun:

```ts
import { ProcessedFile, processVideo } from "@m4k/client";

for await (const value of processVideo("http://localhost:3000", Bun.file("fixtures/video.mp4"), {
  format: "mp4",
  videoCodec: "libx265",
  output: "output/video.mp4",
})) {
  if (value instanceof ProcessedFile) {
    // handle the processed file
  } else {
    // handle the status update
  }
}
```
