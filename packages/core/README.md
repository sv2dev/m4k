# m4k - media kit

A media conversion toolkit based on [ffmpeg](https://ffmpeg.org/) and [sharp](https://sharp.pixelplumbing.com/)/[libvips](https://github.com/libvips/libvips).
It provides queueing and progress reporting via async iterables.

The API is unified for audio, images and videos.

## Usage

### Processing audio

```ts
import { processAudio, ProcessedFile } from "m4k";
// input is a file path or an async iterable of Uint8Arrays or a Blob
for await (const value of processAudio(input, opts)) {
  if (value instanceof ProcessedFile) {
    // do something with the file
  }
}
```

### Processing images

```ts
import { processImage, ProcessedFile } from "m4k";
// input is a file path or an async iterable of Uint8Arrays or a Blob
for await (const value of processImage(input, opts)) {
  if (value instanceof ProcessedFile) {
    // do something with the file
  }
}
```

### Processing videos

```ts
import { processVideo, ProcessedFile } from "m4k";
// input is a file path or an async iterable of Uint8Arrays or a Blob
for await (const value of processVideo(input, opts)) {
  if (value instanceof ProcessedFile) {
    // do something with the file
  }
}
```
