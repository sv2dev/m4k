import { Type as T, type StaticDecode } from "@sinclair/typebox";
import { Queue } from "@sv2dev/queue";
import sharp, { type Sharp } from "sharp";
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

export type OptimizerOptions = StaticDecode<typeof optionsSchema>;
export type Format = Required<OptimizerOptions>["format"];
export type Fit = Required<Required<OptimizerOptions>["resize"]>["fit"];

export function createOptimizer(input: ReadableStream) {
  const s = sharp().rotate();
  return readableFromWeb(input).pipe(s);
}

export function otpimizeImage(
  s: Sharp,
  {
    rotate,
    resize,
    format = "avif",
    quality,
    keepMetadata = false,
    keepExif = false,
    keepIcc = false,
    colorspace,
    crop,
  }: OptimizerOptions
) {
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
  return readableToWeb(s.toFormat(format, { quality }));
}

export const imageQueue = new Queue({
  parallelize: Number(Bun.env.IMAGE_PARALLELIZE ?? 5),
  max: Number(Bun.env.IMAGE_QUEUE_SIZE ?? 100),
});
