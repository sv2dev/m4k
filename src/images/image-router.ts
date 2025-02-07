import { Type as T, type StaticDecode } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import Elysia from "elysia";
import { fileBoundary } from "../util/multipart-form";
import { parseOpts } from "../util/request-parsing";
import { numberQueryParamSchema } from "../util/typebox";
import {
  createOptimizer,
  otpimizeImage as optimizeImage,
  optionsSchema,
  type OptimizerOptions,
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

export function imageRouter<Prefix extends string | undefined>(
  prefix?: Prefix
) {
  return new Elysia({ prefix }).post(
    "/process",
    async ({ request, error }) => {
      let optsArr: OptimizerOptions[];
      try {
        optsArr = parseOpts(request, compiledOptionsSchema, queryToOptions);
      } catch (err) {
        return error(400, (err as RangeError).message);
      }
      if (optsArr.length === 0) {
        return error(400, "No options provided");
      }

      const optimizer = createOptimizer(request.body!);
      const fileStreams = [] as ReadableStream<Uint8Array>[];
      for (const opts of optsArr) {
        fileStreams.push(optimizeImage(optimizer.clone(), opts));
      }
      return new Response(
        async function* () {
          for (let i = 0; i < fileStreams.length; i++) {
            const opts = optsArr[i];
            const { format } = opts;
            const name = `file${i + 1}`;
            const filename = `${name}.${format}`;
            const contentType = Bun.file(filename).type;
            yield fileBoundary({
              first: i === 0,
              name,
              filename,
              contentType,
            });
            const reader = fileStreams[i].getReader();
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              yield value;
            }
            yield fileBoundary();
          }
        } as any as ReadableStream<Uint8Array>,
        {
          headers: {
            "content-type": "multipart/form-data; boundary=file-boundary",
          },
        }
      );
    },
    {
      headers: T.Object({ "x-options": T.Optional(T.String()) }),
      query: querySchema,
    }
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
}: StaticDecode<typeof querySchema>): OptimizerOptions {
  return {
    ...query,
    format: query.format ?? "avif",
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
