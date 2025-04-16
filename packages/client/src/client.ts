import {
  ProcessedFile,
  type ProcessingError,
  type Progress,
  type QueuePosition,
  type RemoteAudioOptions,
  type RemoteImageOptions,
  type RemoteVideoOptions,
} from "@m4k/common";
import { iterableToStream, streamParts } from "@sv2dev/multipart-stream";

/**
 * Process an audio file.
 * @param host - The host of the server.
 * @param input - The input audio file. Can be a stream or a blob.
 * @param opts - The options for the audio processing.
 * @param opts.signal - An optional abort signal.
 * @returns An iterable of the processed audio files.
 */
export async function* processAudio(
  host: string,
  input: AsyncIterable<Uint8Array> | Blob,
  opts: RemoteAudioOptions | RemoteAudioOptions[],
  { signal }: { signal?: AbortSignal } = {}
) {
  yield* runFetch(`${host}/audio/process`, input, opts, { signal });
}

/**
 * Process an image.
 * @param host - The host of the server.
 * @param input - The input image. Can be a stream or a blob.
 * @param opts - The options for the image processing.
 * @param opts.signal - An optional abort signal.
 * @returns An iterable of the processed images.
 */
export async function* processImage(
  host: string,
  input: AsyncIterable<Uint8Array> | Blob,
  opts: RemoteImageOptions | RemoteImageOptions[],
  { signal }: { signal?: AbortSignal } = {}
) {
  yield* runFetch(`${host}/images/process`, input, opts, { signal });
}

/**
 * Process a video.
 * @param host - The host of the server.
 * @param input - The input video. Can be a stream or a blob.
 * @param opts - The options for the video processing.
 * @param opts.signal - An optional abort signal.
 * @returns An iterable of the processed videos.
 */
export async function* processVideo(
  host: string,
  input: AsyncIterable<Uint8Array> | Blob,
  opts: RemoteVideoOptions | RemoteVideoOptions[],
  { signal }: { signal?: AbortSignal } = {}
) {
  yield* runFetch(`${host}/videos/process`, input, opts, { signal });
}

async function* runFetch(
  url: string,
  input: AsyncIterable<Uint8Array> | Blob,
  opts: any,
  { signal }: { signal?: AbortSignal } = {}
) {
  signal?.throwIfAborted();
  const res = await fetch(
    new Request(url, {
      method: "POST",
      body: inputToStream(input),
      headers: { "X-Options": JSON.stringify(opts) },
      signal,
    })
  );
  if (!res.ok) {
    throw new Error(
      `Failed to optimize: [${res.statusText}] ${await res.text()}`
    );
  }
  for await (const part of streamParts(res)) {
    if (part.type === "application/json") {
      const msg = (await part.json()) as
        | Progress
        | QueuePosition
        | ProcessingError;
      if ("error" in msg) {
        signal?.throwIfAborted();
        throw new Error(msg.error);
      }
      yield msg;
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
