import { Type as T, type StaticDecode } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { Hono, type Env, type MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { stream } from "hono/streaming";
import type { RequestHeader } from "hono/utils/headers";
import { validator } from "hono/validator";
import { fileBoundary } from "../util/multipart-form";
import { numberQueryParamSchema } from "../util/typebox-types";
import { tbValidator } from "../util/typebox-validator";
import {
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
const formSchema = T.Object({
  file: T.Any(),
});

type MultiFileHeaders = Partial<Record<RequestHeader, string>> &
  (Record<"X-Options", string> | Record<"x-options", string>);

export const imageRouter = new Hono()
  .post(
    "/process",
    tbValidator("query", querySchema),
    tbValidator("form", formSchema),
    async (c) => {
      const opts = paramsToOptions(c.req.valid("query"));
      const { file } = c.req.valid("form");

      c.header("Content-Type", `image/${opts.format ?? "avif"}`);
      try {
        return stream(c, async (stream) => {
          try {
            await stream.pipe(optimizeImage((file as File).stream(), opts));
          } catch (e) {
            console.warn("Error processing image", (e as Error).message);
            stream.write("Error during streaming image");
          }
        });
      } catch (e) {
        console.warn("Error processing image", (e as Error).message);
        return c.text("Error during image processing", 500);
      }
    }
  )
  .post(
    "/process/multi",
    validator("header", (value) => {
      const json = value["x-options"];
      if (!json)
        throw new HTTPException(400, {
          message: "X-Options header is required",
        });
      let options: any;
      try {
        options = JSON.parse(json);
      } catch (e) {
        throw new HTTPException(400, {
          message: "X-Options header is not valid JSON",
        });
      }
      if (!compiledOptionsArraySchema.Check(options)) {
        const error = compiledOptionsArraySchema.Errors(options).First();
        throw new HTTPException(400, { message: error?.message });
      }
      return compiledOptionsArraySchema.Decode(options);
    }) as MiddlewareHandler<
      Env,
      string,
      {
        in: { header: MultiFileHeaders | MultiFileHeaders[] };
        out: { header: StaticDecode<typeof optionsSchema>[] };
      }
    >,
    tbValidator("form", formSchema),
    async (c) => {
      const optionsArr = c.req.valid("header");

      const { file } = c.req.valid("form");

      c.header("Content-Type", "multipart/form-data; boundary=file-boundary");
      try {
        return stream(c, async (stream) => {
          for (let i = 0; i < optionsArr.length; i++) {
            const opts = optionsArr[i];
            const { format } = opts;
            const name = `file${i + 1}`;
            const filename = `${name}.${format}`;
            const contentType = `image/${format}`;
            try {
              await stream.write(
                fileBoundary({ first: i === 0, name, filename, contentType })
              );
              await stream.pipe(optimizeImage(file.stream(), opts));
            } catch (e) {
              console.warn("Error processing image", (e as Error).message);
              stream.write("Error during streaming image");
            }
          }
          await stream.write(fileBoundary());
        });
      } catch (e) {
        console.warn("Error processing image", (e as Error).message);
        return c.text("Error during image processing", 500);
      }
    }
  );

function paramsToOptions({
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
