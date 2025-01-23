import { Type as T } from "@sinclair/typebox";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { Readable } from "node:stream";
import { numberQueryParamSchema } from "../util/typebox-types";
import { tbValidator } from "../util/typebox-validator";
import {
  createImageOptimizer,
  fits,
  formats,
  type Fit,
  type Format,
} from "./image-optimizer";

const querySchema = T.Object({
  rotate: T.Optional(numberQueryParamSchema),
  width: T.Optional(numberQueryParamSchema),
  height: T.Optional(numberQueryParamSchema),
  fit: T.Optional(T.Union(fits.map((fit) => T.Literal(fit)))),
  format: T.Optional(T.Union(formats.map((format) => T.Literal(format)))),
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
const formSchema = T.Object({
  file: T.Any(),
});

export const imageRouter = new Hono().post(
  "/process",
  tbValidator("query", querySchema),
  tbValidator("form", formSchema),
  async (c) => {
    const {
      width,
      height,
      fit,
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight,
      ...query
    } = c.req.valid("query");
    const opts = {
      ...query,
      format: query.format ?? ("avif" as Format),
      ...((width || height) && {
        resize: {
          width,
          height,
          fit: fit ?? ("inside" as Fit),
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
    const { file } = c.req.valid("form");

    c.header("Content-Type", `image/${opts.format}`);
    try {
      const optimizeImage = createImageOptimizer(opts);
      return stream(c, async (stream) => {
        try {
          await stream.pipe(
            readableToWeb(
              readableFromWeb((file as File).stream()).pipe(optimizeImage)
            )
          );
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
);

// Currently bun / node types don't match with TS lib types for ReadableStream, so we need to cast to any.
function readableFromWeb(stream: ReadableStream) {
  return Readable.fromWeb(stream as any);
}

function readableToWeb(stream: Readable) {
  return Readable.toWeb(stream) as unknown as ReadableStream;
}
