import { type ImageOptions, ProcessedFile } from "@m4k/common";
import { createReadStream } from "node:fs";
import sharp from "sharp";
import { createQueue } from "tasque";
import { exhaustAsyncIterableToWritable } from "../util/streams";

export type Format = Required<ImageOptions>["format"];
export type Fit = Required<Required<ImageOptions>["resize"]>["fit"];

/**
 * Process an image.
 * @param input - The input image. Can be a file path, a stream or a blob.
 * @param opts - The options for the image processing.
 * @param signal - An optional abort signal.
 * @returns An iterable of the processed images.
 */
export function processImage(
  input: string | AsyncIterable<Uint8Array> | Blob,
  opts: ImageOptions | ImageOptions[],
  { signal }: { signal?: AbortSignal } = {}
) {
  const sharpInstance = sharp();
  const iterable = imageQueue.iterate(async function* () {
    opts = Array.isArray(opts) ? opts : [opts];
    void exhaustAsyncIterableToWritable(
      typeof input === "string"
        ? createReadStream(input)
        : "stream" in input
        ? input.stream()
        : input,
      sharpInstance
    );

    const files = opts.map(
      async (
        {
          colorspace,
          crop,
          format = "avif",
          keepExif,
          keepIcc,
          keepMetadata,
          quality,
          resize,
          rotate,
        },
        idx
      ) => {
        let s = sharpInstance.clone();
        s = s.rotate(rotate);
        if (resize)
          s = s.resize({
            ...resize,
            fit: resize.fit ?? "inside",
          });
        if (keepMetadata) s = s.keepMetadata();
        if (keepExif) s = s.keepExif();
        if (keepIcc) s = s.keepIccProfile();
        if (colorspace) s = s.toColorspace(colorspace);
        if (crop) {
          s = s.extract({
            ...crop,
            left: crop.left ?? 0,
            top: crop.top ?? 0,
          });
        }
        s = s.toFormat(format, { quality });

        return new ProcessedFile(
          `file${idx + 1}.${format}`,
          `image/${format}`,
          s
        );
      }
    );
    let done = 0;
    yield { progress: 0 };
    for (const file of files) {
      yield await file;
      done++;
      yield { progress: Math.round((done / files.length) * 100) };
    }
  }, signal);
  if (!iterable) return null;
  return (async function* () {
    for await (const [position, value] of iterable) {
      if (position !== null) yield { position };
      else yield value;
    }
  })();
}

/**
 * The queue for image processing.
 */
export const imageQueue = createQueue({
  parallelize: Number(process.env.IMAGE_PARALLELIZE ?? 5),
  max: Number(process.env.IMAGE_QUEUE_SIZE ?? 100),
});
