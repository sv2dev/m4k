import { iterableToStream, streamParts } from "@sv2dev/multipart-stream";
import type { ProcessingError, Progress, QueuePosition } from "./types";
import type { VideoOptimizerOptions } from "./videos/video-optimizer";
export async function* optimizeVideo(
  host: string,
  stream: AsyncIterable<Uint8Array> | Blob,
  options: VideoOptimizerOptions | VideoOptimizerOptions[]
) {
  const res = await fetch(`${host}/videos/process`, {
    method: "POST",
    body:
      stream instanceof ReadableStream || !(Symbol.asyncIterator in stream)
        ? stream
        : iterableToStream(stream),
    headers: {
      "X-Options": JSON.stringify(options),
    },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to optimize video: [${res.statusText}] ${res.text()}`
    );
  }
  for await (const part of streamParts(res)) {
    if (part.type === "application/json") {
      yield (await part.json()) as Progress | QueuePosition | ProcessingError;
    } else if (part.type !== "text/plain") {
      yield part;
    }
  }
}
