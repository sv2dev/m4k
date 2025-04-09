import type { ImageOptions } from "@m4k/common";
import { imageOptionsSchema } from "@m4k/typebox";
import { Type as T } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { ProcessedFile, processImage } from "m4k";
import { rm } from "node:fs/promises";
import { parseOpts } from "../util/request-parsing";
import { error, queueAndStream } from "../util/response";
import { numberQueryParamSchema } from "../util/typebox";

const compiledOptionsSchema = TypeCompiler.Compile(imageOptionsSchema);

export async function processImageHandler(request: Request) {
  if (!request.body) return error(400, "No body provided");
  let optsArr: ImageOptions[];
  try {
    optsArr = parseOpts(request, compiledOptionsSchema, queryToOptions);
  } catch (err) {
    return error(400, (err as RangeError).message);
  }
  if (optsArr.length === 0) return error(400, "No options provided");

  const iterable = processImage(request.body, optsArr, {
    signal: request.signal,
  });
  if (!iterable) return error(409, "Queue is full");
  return queueAndStream(
    (async function* () {
      let idx = 0;
      for await (const value of iterable) {
        if (value instanceof ProcessedFile) {
          const { output, name } = optsArr[idx];
          if (output) {
            const out = Bun.file(output);
            const writer = out.writer();
            for await (const chunk of value.stream!) {
              writer.write(chunk);
              await writer.flush();
            }
            await writer.end();
            await rm(value.name, { force: true });
          } else if (name) {
            yield new ProcessedFile(name, value.type, value.stream);
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

const querySchema = T.Object({
  rotate: T.Optional(numberQueryParamSchema),
  width: T.Optional(numberQueryParamSchema),
  height: T.Optional(numberQueryParamSchema),
  fit: imageOptionsSchema.properties.resize.properties.fit,
  format: imageOptionsSchema.properties.format,
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
const compiledQuerySchema = TypeCompiler.Compile(querySchema);

function queryToOptions(params: unknown): ImageOptions {
  const {
    width,
    height,
    fit,
    cropLeft,
    cropTop,
    cropWidth,
    cropHeight,
    ...query
  } = compiledQuerySchema.Decode(params);
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
