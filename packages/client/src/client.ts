import {
  ConvertedFile,
  type ImageOptimizerOptions,
  type ProcessingError,
  type Progress,
  type QueuePosition,
  type VideoOptimizerOptions,
} from "@m4k/types";
import { iterableToStream, streamParts } from "@sv2dev/multipart-stream";

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
    throw new Error(
      `Failed to optimize: [${res.statusText}] ${await res.text()}`
    );
  }
  for await (const part of streamParts(res)) {
    if (part.type === "application/json") {
      yield (await part.json()) as T;
    } else if (part.type !== "text/plain") {
      yield new ConvertedFile(
        part.filename!,
        part.type!,
        part
      ) as ConvertedFile & {
        stream: AsyncIterable<Uint8Array>;
      };
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
