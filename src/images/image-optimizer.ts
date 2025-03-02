import { Type as T, type StaticDecode } from "@sinclair/typebox";
import sharp from "sharp";
import { createQueue } from "tasque";
import { VirtualFile } from "../util/file";
import { readableFromWeb, readableToWeb } from "../util/streams";
import { numberQueryParamSchema } from "../util/typebox";

export const optionsSchema = T.Object({
  rotate: T.Optional(numberQueryParamSchema),
  resize: T.Optional(
    T.Object({
      width: T.Optional(numberQueryParamSchema),
      height: T.Optional(numberQueryParamSchema),
      fit: T.Optional(
        T.Union([
          T.Literal("contain"),
          T.Literal("cover"),
          T.Literal("fill"),
          T.Literal("inside"),
          T.Literal("outside"),
        ])
      ),
    })
  ),
  format: T.Optional(
    T.Union([
      T.Literal("avif"),
      T.Literal("jpeg"),
      T.Literal("png"),
      T.Literal("webp"),
      T.Literal("tiff"),
      T.Literal("magick"),
      T.Literal("openslide"),
      T.Literal("dz"),
      T.Literal("ppm"),
      T.Literal("fits"),
      T.Literal("gif"),
      T.Literal("svg"),
      T.Literal("heif"),
      T.Literal("pdf"),
      T.Literal("jp2"),
    ])
  ),
  quality: T.Optional(numberQueryParamSchema),
  keepMetadata: T.Optional(T.Boolean()),
  keepExif: T.Optional(T.Boolean()),
  keepIcc: T.Optional(T.Boolean()),
  colorspace: T.Optional(T.String()),
  crop: T.Optional(
    T.Object({
      left: T.Optional(T.Number()),
      top: T.Optional(T.Number()),
      width: T.Number(),
      height: T.Number(),
    })
  ),
});

export type ImageOptimizerOptions = StaticDecode<typeof optionsSchema>;
export type Format = Required<ImageOptimizerOptions>["format"];
export type Fit = Required<Required<ImageOptimizerOptions>["resize"]>["fit"];

export function otpimizeImage(
  input: ReadableStream | Blob,
  opts: ImageOptimizerOptions[],
  signal?: AbortSignal
) {
  const sharpInstance = sharp().rotate();
  const iterable = imageQueue.iterate(async function* () {
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
          if (rotate) s = s.rotate(rotate);
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
          return new VirtualFile(readableToWeb(s), {
            type: `image/${format}`,
            name: `file${idx + 1}.${format}`,
          });
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
  return async function* () {
    for await (const [position, value] of iterable) {
      if (position !== null) yield { position };
      else yield value;
    }
  };
}

const imageQueue = createQueue({
  parallelize: Number(Bun.env.IMAGE_PARALLELIZE ?? 5),
  max: Number(Bun.env.IMAGE_QUEUE_SIZE ?? 100),
});
