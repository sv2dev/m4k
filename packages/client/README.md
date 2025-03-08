# m4k - media kit client

A client for the media kit server `@m4k/server`.
It provides queueing and progress reporting via async iterables.

## Usage

Converting images:

```ts
import { optimizeImage, ConvertedFile } from "@m4k/client";
// host is the URL of the media kit server
// input is a ReadableStream or Blob
for await (const value of optimizeImage(host, input, opts)) {
  if (value instanceof ConvertedFile) {
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
import { optimizeVideo, ConvertedFile } from "@m4k/client";
// host is the URL of the media kit server
// input is a file path
for await (const value of optimizeVideo(host, input, opts)) {
  if (value instanceof ConvertedFile) {
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
