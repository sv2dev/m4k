# m4k - media kit client

A client for the media kit server `@m4k/server`.
It provides queueing and progress reporting via async iterables.

## Usage

Converting images:

```ts
import { processImage, ProcessedFile } from "@m4k/client";
// host is the URL of the media kit server
// input is a AsyncIterable or Blob
for await (const value of processImage(host, input, opts)) {
  if (value instanceof ProcessedFile) {
    // do something with the file
  } else if ("position" in value) {
    // do something with the queue position
  } else if ("progress" in value) {
    // do something with the progress
  } else {
    // handle value.error
  }
}
```

Converting videos:

```ts
import { processVideo, ProcessedFile } from "@m4k/client";
// host is the URL of the media kit server
// input is a file path
for await (const value of processVideo(host, input, opts)) {
  if (value instanceof ProcessedFile) {
    // do something with the file
  } else if ("position" in value) {
    // do something with the queue position
  } else if ("progress" in value) {
    // do something with the progress
  } else {
    // handle value.error
  }
}
```
