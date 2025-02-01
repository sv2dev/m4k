import Elysia from "elysia";
import {
  audioEncoders,
  audioFilters,
  inputFormats,
  optimizeVideo,
  optionsSchema,
  outputFormats,
  videoEncoders,
  videoFilters,
} from "./video-optimizer";

export function videoRouter<Prefix extends string | undefined>(
  prefix?: Prefix
) {
  return new Elysia({ prefix })
    .post(
      "/process",
      async ({ query: opts, request }) => {
        const video = await optimizeVideo(opts, request.body!);
        if (!video) return new Response(undefined, { status: 201 });
        const { readable, writable } = new TransformStream();
        video
          .stream()
          .pipeTo(writable)
          .then(async () => {
            try {
              await video.unlink();
            } catch (error) {
              console.error("Cleanup failed:", error);
            }
          });
        const res = new Response(readable, {
          headers: { "Content-Type": video.type },
        });
        return res;
      },
      { query: optionsSchema }
    )
    .get("/formats", () => outputFormats)
    .get("/input-formats", () => inputFormats)
    .get("/encoders", () => videoEncoders)
    .get("/filters", () => videoFilters)
    .get("/audio-encoders", () => audioEncoders)
    .get("/audio-filters", () => audioFilters);
}
