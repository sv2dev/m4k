import { Type as T } from "@sinclair/typebox";
import Elysia from "elysia";
import { TypeCompiler } from "elysia/type-system";
import { extname } from "node:path";
import { BOUNDARY, END, part } from "../util/multipart-mixed";
import { parseOpts } from "../util/request-parsing";
import {
  optimizeVideo,
  optionsSchema,
  videoQueue,
  type OptimizerOptions,
} from "./video-optimizer";
import {
  getAudioEncoders,
  getAudioFilters,
  getInputFormats,
  getOutputFormats,
  getVideoEncoders,
  getVideoFilters,
} from "./video-utils";
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
        const iterable = videoQueue.pushAndIterate(async () => {
          const video = await optimizeVideo(opts, request.body!);
          if (!video) {
            writer.write(END);
            writer.close();
            return;
          }
          writer.write(
            part({
              first: first,
              contentType: video.type,
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
          w.write(END);
          w.close();
        })!;
        streamQueuePosition();
        return new Response(readable, {
          headers: {
            "content-type": `multipart/mixed; boundary="${BOUNDARY}"`,
            // "transfer-encoding": "chunked",
          },
        });

        async function streamQueuePosition() {
          for await (const [position] of iterable) {
            if (position !== null && position > 0) {
              writer.write(part({ first, payload: { position } }));
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
    .get("/formats", () => getOutputFormats())
    .get("/input-formats", () => getInputFormats())
    .get("/encoders", () => getVideoEncoders())
    .get("/filters", () => getVideoFilters())
    .get("/audio-encoders", () => getAudioEncoders())
    .get("/audio-filters", () => getAudioFilters());
}
