import { Type as T, type StaticDecode } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import Elysia from "elysia";
import { fileBoundary } from "../util/multipart-form";
import { numberQueryParamSchema, parse } from "../util/typebox";
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
});
const compiledOptionsArraySchema = TypeCompiler.Compile(T.Array(optionsSchema));

export function imageRouter<Prefix extends string | undefined>(
  prefix?: Prefix
) {
  return new Elysia({ prefix })
    .post(
      "/process",
      async ({ query, request, set }) => {
        const image = optimizeImage(
          createOptimizer(request.body!),
          queryToOptions(query)
        );
        set.headers = { "Content-Type": `image/${query.format ?? "avif"}` };
        return image;
      },
      { query: querySchema }
    )
    .post(
      "/process/multi",
      ({ headers, request }) => {
        let rawOpts: any;
        try {
          rawOpts = JSON.parse(headers["x-options"]);
        } catch (error) {
          throw new RangeError("X-Options header is not valid JSON");
        }
        const optsArr = parse(compiledOptionsArraySchema, rawOpts);
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
              const contentType = `image/${format}`;
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
      { headers: T.Object({ "x-options": T.String() }) }
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
