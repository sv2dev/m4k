import {
  ProcessedFile,
  imageClassifier,
  inlineClassificationProfile,
  invalidInlineClassification,
  isImageNoOp,
  isValidClassificationResult,
  encodeOptions,
  type InlineClassification,
  type ProcessingError,
  type Progress,
  type QueuePosition,
  type RemoteAudioOptions,
  type RemoteImageOptions,
  type RemoteVideoOptions,
} from "@m4k/common";
import { readJsonParts, readJsonResponse } from "./read-json-response.js";
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
  { signal }: { signal?: AbortSignal } = {},
) {
  yield* runFetch(`${host}/audio/process`, input, opts, { signal });
}

/**
 * Process an image.
 *
 * An entry with `classify` is classified on the server right after its output was produced, so
 * the converted file never travels back for classification. Its `InlineClassification` is yielded
 * after the file (or instead of it, with `discard`). The stream fails if the server omits one.
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
  { signal }: { signal?: AbortSignal } = {},
) {
  const optsArr = Array.isArray(opts) ? opts : [opts];
  const invalid = invalidInlineClassification(optsArr);
  if (invalid) throw new RangeError(invalid);
  const classifying = optsArr.some((option) => option.classify);
  if (classifying || optsArr.some((option) => option.embeddedPreview)) {
    const response = await fetch(`${host}/info`, {
      ...(signal ? { signal } : {}),
      redirect: "error",
    });
    if (!response.ok) throw new Error("M4K capability check failed");
    const info = (await readJsonResponse(response)) as {
      service?: string;
      imageProfiles?: string[];
      classifiers?: { id: string; version: string; revision: string }[];
    };
    const profiles =
      info.service === "m4k" && Array.isArray(info.imageProfiles) ? info.imageProfiles : [];
    const preview = optsArr.some((option) => option.embeddedPreview);
    if (preview && !profiles.includes("embedded-preview/1"))
      throw new RangeError("M4K does not support embedded preview extraction");
    if (
      classifying &&
      (!profiles.includes(inlineClassificationProfile) ||
        !Array.isArray(info.classifiers) ||
        !info.classifiers.some(
          (c) =>
            c.id === imageClassifier.id &&
            c.version === imageClassifier.version &&
            c.revision === imageClassifier.revision,
        ))
    )
      throw new RangeError("M4K does not support classification while processing images");
  }
  if (input instanceof Blob && input.type) {
    const inputExt = input.type.replace(/^image\//, "").toLowerCase();
    if (optsArr.every((o) => isImageNoOp(o, inputExt))) {
      yield { progress: 0 } as Progress;
      for (let i = 0; i < optsArr.length; i++) {
        const ext = optsArr[i].ext ?? optsArr[i].format ?? inputExt;
        yield new ProcessedFile(
          optsArr[i].name ?? `file${i + 1}.${ext}`,
          `image/${ext}`,
          input.stream() as unknown as AsyncIterable<Uint8Array>,
        ) as ProcessedFile & { stream: AsyncIterable<Uint8Array> };
        yield { progress: Math.round(((i + 1) / optsArr.length) * 100) } as Progress;
      }
      return;
    }
  }
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
  { signal }: { signal?: AbortSignal } = {},
) {
  yield* runFetch(`${host}/videos/process`, input, opts, { signal });
}

/** Stream conversion results, rejecting redirects for pinned profiles and bounding JSON parts. */
async function* runFetch(
  url: string,
  input: AsyncIterable<Uint8Array> | Blob,
  opts: any,
  { signal }: { signal?: AbortSignal } = {},
) {
  signal?.throwIfAborted();
  const pinned = (Array.isArray(opts) ? opts : [opts]).some(
    (option) => option.embeddedPreview === true || !!option.classify,
  );
  const res = await fetch(
    new Request(url, {
      redirect: pinned ? "error" : "follow",
      method: "POST",
      body: inputToStream(input),
      headers: { "X-Options": encodeOptions(opts) },
      signal,
    }),
  );
  if (!res.ok) {
    throw new Error(`Failed to optimize: [${res.statusText}] ${await res.text()}`);
  }
  const requested = (Array.isArray(opts) ? opts : [opts]) as RemoteImageOptions[];
  const awaiting = new Set(requested.flatMap((o, i) => ("classify" in o && o.classify ? [i] : [])));
  // Audio and video entries have no `classify`; this only guards image requests.
  for await (const part of streamParts(res)) {
    if (part.type === "application/json") {
      const msg = (await readJsonParts(part)) as
        | Progress
        | QueuePosition
        | ProcessingError
        | InlineClassification;
      if ("error" in msg) {
        signal?.throwIfAborted();
        throw new Error(msg.error);
      }
      if ("classification" in msg) {
        const { index } = msg.classification;
        const asked = requested[index]?.classify;
        const expected = awaiting.delete(index) && asked !== undefined;
        if (!expected || !isValidClassificationResult(msg.classification, asked))
          throw new Error("Invalid classification response");
      }
      yield msg;
    } else if (part.type !== "text/plain") {
      yield new ProcessedFile(part.filename!, part.type!, part) as ProcessedFile & {
        stream: AsyncIterable<Uint8Array>;
      };
    }
  }
  if (awaiting.size > 0) throw new Error("M4K did not return every requested classification");
}

function inputToStream(input: AsyncIterable<Uint8Array> | Blob) {
  return input instanceof ReadableStream || !(Symbol.asyncIterator in input)
    ? input
    : iterableToStream(input);
}
