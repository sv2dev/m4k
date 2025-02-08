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
  videoQueue,
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
        if (videoQueue.size === videoQueue.max) {
          return error(503, "Queue is full");
        }
        let opts: OptimizerOptions | undefined;
        try {
          [opts] = parseOpts(request, compiledOptionsSchema);
        } catch (err) {
          return error(400, (err as RangeError).message);
        }
        if (!opts) {
          return error(400, "No options provided");
        }
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        let first = true;
        const te = new TextEncoder();
        const iterable = videoQueue.pushAndIterate(async () => {
          const video = await optimizeVideo(opts, request.body!);
          if (!video) {
            writer.write(fileBoundary());
            writer.close();
            return;
          }
          writer.write(
            fileBoundary({
              first: first,
              contentType: video.type,
              name: "video",
              filename: `video${extname(video.name!)}`,
            })
          );
          first = false;
          writer.releaseLock();
          await video
            .stream()
            .pipeTo(writable, { preventClose: true })
            .then(async () => {
              try {
                await video.unlink();
              } catch (error) {
                console.error("Cleanup failed:", error);
              }
            });
          const w = writable.getWriter();
          w.write(fileBoundary());
          w.close();
        })!;
        streamQueuePosition();
        return new Response(readable, {
          headers: {
            "content-type": "multipart/form-data; boundary=file-boundary",
          },
        });

        async function streamQueuePosition() {
          for await (const [position] of iterable) {
            if (position !== null && position > 0) {
              writer.write(
                fileBoundary({
                  first,
                  contentType: "application/json",
                })
              );
              writer.write(te.encode(JSON.stringify({ position })));
              first = false;
            }
          }
        }
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
