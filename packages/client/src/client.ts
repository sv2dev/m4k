import {
  ProcessedFile,
  type ImageOptions,
  type ProcessingError,
  type Progress,
  type QueuePosition,
  type VideoOptions,
} from "@m4k/common";
import { iterableToStream, streamParts } from "@sv2dev/multipart-stream";

let f = fetch;

export function setFetch(ftch: typeof fetch) {
  f = ftch;
}

export async function* processImage(
  host: string,
  input: AsyncIterable<Uint8Array> | Blob,
  opts: ImageOptions | ImageOptions[]
) {
  yield* optimizeFetch<Progress | QueuePosition | ProcessingError>(
    `${host}/images/process`,
    input,
    opts
  );
}

export async function* processVideo(
  host: string,
  input: AsyncIterable<Uint8Array> | Blob,
  opts: VideoOptions | VideoOptions[]
) {
  yield* optimizeFetch<Progress | QueuePosition | ProcessingError>(
    `${host}/videos/process`,
    input,
    opts
  );
}

async function* optimizeFetch<T>(
  url: string,
  input: AsyncIterable<Uint8Array> | Blob,
  opts: any
) {
  const res = await f(
    new Request(url, {
      method: "POST",
      body: inputToStream(input),
      headers: { "X-Options": JSON.stringify(opts) },
    })
  );
  if (!res.ok) {
    throw new Error(
      `Failed to optimize: [${res.statusText}] ${await res.text()}`
    );
  }
  for await (const part of streamParts(res)) {
    if (part.type === "application/json") {
      yield (await part.json()) as T;
    } else if (part.type !== "text/plain") {
      yield new ProcessedFile(
        part.filename!,
        part.type!,
        part
      ) as ProcessedFile & {
        stream: AsyncIterable<Uint8Array>;
      };
    }
  }
}

function inputToStream(input: AsyncIterable<Uint8Array> | Blob) {
  return input instanceof ReadableStream || !(Symbol.asyncIterator in input)
    ? input
    : iterableToStream(input);
}
