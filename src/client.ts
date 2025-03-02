import { iterableToStream, streamParts } from "@sv2dev/multipart-stream";
import type { ImageOptimizerOptions } from "./images/image-optimizer";
import type { ProcessingError, Progress, QueuePosition } from "./types";
import type { VideoOptimizerOptions } from "./videos/video-optimizer";

export async function* optimizeImage(
  host: string,
  input: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | Blob,
  opts: ImageOptimizerOptions | ImageOptimizerOptions[]
) {
  yield* optimizeFetch<Progress | QueuePosition | ProcessingError>(
    `${host}/images/process`,
    input,
    opts
  );
}

export async function* optimizeVideo(
  host: string,
  input: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | Blob,
  opts: VideoOptimizerOptions | VideoOptimizerOptions[]
) {
  yield* optimizeFetch<Progress | QueuePosition | ProcessingError>(
    `${host}/videos/process`,
    input,
    opts
  );
}

async function* optimizeFetch<T>(
  url: string,
  input: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | Blob,
  opts: any
) {
  const res = await fetch(url, {
    method: "POST",
    body: inputToStream(input),
    headers: { "X-Options": JSON.stringify(opts) },
  });
  if (!res.ok) {
    throw new Error(`Failed to optimize: [${res.statusText}] ${res.text()}`);
  }
  for await (const part of streamParts(res)) {
    if (part.type === "application/json") {
      yield (await part.json()) as T;
    } else if (part.type !== "text/plain") {
      yield part;
    }
  }
}

function inputToStream(
  input: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | Blob
) {
  return input instanceof ReadableStream || !(Symbol.asyncIterator in input)
    ? input
    : iterableToStream(input);
}
