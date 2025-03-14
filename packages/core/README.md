# m4k - media kit

A media conversion toolkit based on [ffmpeg](https://ffmpeg.org/) and [sharp](https://sharp.pixelplumbing.com/)/[libvips](https://github.com/libvips/libvips).
It provides queueing and progress reporting via async iterables.

## Usage

Image optimization happens completely in memory.

```ts
import { optimizeImage, ConvertedFile } from "m4k";
// input is a ReadableStream or Blob
for await (const value of optimizeImage(input, opts)) {
  if (value instanceof ConvertedFile) {
    // do something with the file
  }
}
```

For lower memory usage, video optimization happens with files.

```ts
import { optimizeVideo, ConvertedFile } from "m4k";
// input is a file path
for await (const value of optimizeVideo(input, opts)) {
  if (value instanceof ConvertedFile) {
    // do something with the file
  }
}
```
