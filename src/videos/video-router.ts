import { Type as T } from "@sinclair/typebox";
import Elysia from "elysia";
import { TypeCompiler } from "elysia/type-system";
import { extname } from "node:path";
import { fileBoundary } from "../util/multipart-form";
import { parseOpts } from "../util/request-parsing";
import {
  audioEncoders,
  audioFilters,
  inputFormats,
  optimizeVideo,
  optionsSchema,
  outputFormats,
  videoEncoders,
  videoFilters,
  type OptimizerOptions,
} from "./video-optimizer";
const compiledOptionsSchema = TypeCompiler.Compile(optionsSchema);

export function videoRouter<Prefix extends string | undefined>(
  prefix?: Prefix
) {
  return new Elysia({ prefix })
    .post(
      "/process",
      async ({ request, error }) => {
        let opts: OptimizerOptions | undefined;
        try {
          [opts] = parseOpts(request, compiledOptionsSchema);
        } catch (err) {
          return error(400, (err as RangeError).message);
        }
        if (!opts) {
          return error(400, "No options provided");
        }
        const video = await optimizeVideo(opts, request.body!);
        if (!video) return new Response(undefined, { status: 201 });
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        writer.write(
          fileBoundary({
            first: true,
            contentType: video.type,
            name: "video",
            filename: `video${extname(video.name!)}`,
          })
        );
        writer.releaseLock();
        video
          .stream()
          .pipeTo(writable, { preventClose: true })
          .then(async () => {
            const writer = writable.getWriter();
            writer.write(fileBoundary());
            writer.close();
            try {
              await video.unlink();
            } catch (error) {
              console.error("Cleanup failed:", error);
            }
          });
        return new Response(readable, {
          headers: {
            "content-type": "multipart/form-data; boundary=file-boundary",
          },
        });
      },
      {
        headers: T.Object({ "x-options": T.Optional(T.String()) }),
        query: optionsSchema,
      }
    )
    .get("/formats", () => outputFormats)
    .get("/input-formats", () => inputFormats)
    .get("/encoders", () => videoEncoders)
    .get("/filters", () => videoFilters)
    .get("/audio-encoders", () => audioEncoders)
    .get("/audio-filters", () => audioFilters);
}
