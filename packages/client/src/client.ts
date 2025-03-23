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

/**
 * Process an image.
 * @param host - The host of the server.
 * @param input - The input image. Can be a stream or a blob.
 * @param opts - The options for the image processing.
 * @returns An iterable of the processed images.
 */
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

/**
 * Process a video.
 * @param host - The host of the server.
 * @param input - The input video. Can be a stream or a blob.
 * @param opts - The options for the video processing.
 * @returns An iterable of the processed videos.
 */
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
