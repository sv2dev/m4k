import type { ImageOptimizerOptions } from "@m4k/common";
import { Type as T, type StaticDecode } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { ConvertedFile, optimizeImage } from "m4k";
import { rm } from "node:fs/promises";
import { parseOpts } from "../util/request-parsing";
import { error, queueAndStream } from "../util/response";
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

const querySchema = T.Object({
  rotate: T.Optional(numberQueryParamSchema),
  width: T.Optional(numberQueryParamSchema),
  height: T.Optional(numberQueryParamSchema),
  fit: optionsSchema.properties.resize.properties.fit,
  format: optionsSchema.properties.format,
  quality: T.Optional(numberQueryParamSchema),
  keepMetadata: T.Optional(T.Boolean()),
  keepExif: T.Optional(T.Boolean()),
  keepIcc: T.Optional(T.Boolean()),
  colorspace: T.Optional(T.String()),
  cropLeft: T.Optional(T.Number()),
  cropTop: T.Optional(T.Number()),
  cropWidth: T.Optional(T.Number()),
  cropHeight: T.Optional(T.Number()),
  output: T.Optional(T.String()),
  name: T.Optional(T.String()),
  options: T.Optional(T.String()),
});
const compiledOptionsSchema = TypeCompiler.Compile(optionsSchema);

export async function processImageHandler(request: Request) {
  let optsArr: ImageOptimizerOptions[];
  try {
    optsArr = parseOpts(request, compiledOptionsSchema, queryToOptions);
  } catch (err) {
    return error(400, (err as RangeError).message);
  }
  if (optsArr.length === 0) return error(400, "No options provided");
  if (!request.body) return error(400, "No body provided");

  const iterable = optimizeImage(request.body, optsArr, request.signal);
  if (!iterable) return error(409, "Queue is full");
  return queueAndStream(
    (async function* () {
      let idx = 0;
      for await (const value of iterable) {
        if (value instanceof ConvertedFile) {
          const { output, name } = optsArr[idx];
          if (output) {
            await Bun.write(output, Bun.file(value.name));
            await rm(value.name, { force: true });
          } else if (name) {
            yield new ConvertedFile(name, value.type, value.stream);
          } else {
            yield value;
          }
          idx++;
        } else {
          yield value;
        }
      }
    })()
  );
}

function queryToOptions({
  width,
  height,
  fit,
  cropLeft,
  cropTop,
  cropWidth,
  cropHeight,
  ...query
}: StaticDecode<typeof querySchema>): ImageOptimizerOptions {
  return {
    ...query,
    ...((width || height) && {
      resize: {
        width,
        height,
        fit: fit ?? "inside",
      },
    }),
    ...(cropWidth &&
      cropHeight && {
      crop: {
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight,
      },
    }),
  };
}
