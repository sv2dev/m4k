import { type ImageOptimizerOptions, ConvertedFile } from "@m4k/common";
import sharp from "sharp";
import { createQueue } from "tasque";
import { readableFromWeb, readableToWeb } from "../util/streams";

export type Format = Required<ImageOptimizerOptions>["format"];
export type Fit = Required<Required<ImageOptimizerOptions>["resize"]>["fit"];

export function optimizeImage(
  input: ReadableStream | Blob,
  opts: ImageOptimizerOptions | ImageOptimizerOptions[],
  signal?: AbortSignal
) {
  const sharpInstance = sharp();
  const iterable = imageQueue.iterate(async function* () {
    opts = Array.isArray(opts) ? opts : [opts];
    readableFromWeb("stream" in input ? input.stream() : input).pipe(
      sharpInstance
    );
    const files = await Promise.all(
      opts.map(
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

          return new ConvertedFile(
            `file${idx + 1}.${format}`,
            `image/${format}`,
            readableToWeb(s)
          );
        }
      )
    );
    let done = 0;
    yield { progress: 0 };
    for (const file of files) {
      yield file;
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

export const imageQueue = createQueue({
  parallelize: Number(process.env.IMAGE_PARALLELIZE ?? 5),
  max: Number(process.env.IMAGE_QUEUE_SIZE ?? 100),
});
