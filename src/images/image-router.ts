import { Type as T, type StaticDecode } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { parseOpts } from "../util/request-parsing";
import { error, queueAndStream } from "../util/response";
import { numberQueryParamSchema } from "../util/typebox";
import {
  optimizeImage,
  optionsSchema,
  type ImageOptimizerOptions,
} from "./image-optimizer";

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
  options: T.Optional(T.String()),
});
const compiledOptionsSchema = TypeCompiler.Compile(optionsSchema);

export async function processImages(request: Request) {
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
  return queueAndStream(iterable);
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
