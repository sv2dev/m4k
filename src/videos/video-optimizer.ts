import { Type as T, type StaticDecode } from "@sinclair/typebox";
import { Queue } from "@sv2dev/queue";
import ffmpeg from "fluent-ffmpeg";
import { promisify } from "node:util";

const ffmpegPath =
  Bun.env.FFMPEG_PATH ?? (await import("@ffmpeg-installer/ffmpeg")).path;
ffmpeg.setFfmpegPath(ffmpegPath);

const [formats, encoders, filters] = await Promise.all([
  promisify(ffmpeg.getAvailableFormats)(),
  promisify(ffmpeg.getAvailableEncoders)(),
  promisify(ffmpeg.getAvailableFilters)(),
]);

export const audioEncoders = Object.entries(encoders)
  .filter(([_, e]) => e.type === "audio")
  .reduce(
    (acc, [name, { description }]) => ({ ...acc, [name]: description }),
    {}
  );
export const videoEncoders = Object.entries(encoders)
  .filter(([_, e]) => e.type === "video")
  .reduce(
    (acc, [name, { description }]) => ({ ...acc, [name]: description }),
    {}
  );
export const audioFilters = Object.entries(filters)
  .filter(([_, f]) => f.output === "audio")
  .reduce(
    (acc, [name, { description }]) => ({ ...acc, [name]: description }),
    {}
  );
export const videoFilters = Object.entries(filters)
  .filter(([_, f]) => f.output === "video")
  .reduce(
    (acc, [name, { description }]) => ({ ...acc, [name]: description }),
    {}
  );
export const inputFormats = Object.keys(formats).reduce(
  (acc, f) =>
    formats[f].canDemux ? { ...acc, [f]: formats[f].description } : acc,
  {}
);
export const outputFormats = Object.keys(formats).reduce(
  (acc, f) =>
    formats[f].canMux ? { ...acc, [f]: formats[f].description } : acc,
  {}
);

export const optionsSchema = T.Object({
  audioBitrate: T.Optional(T.Union([T.String(), T.Number()])),
  audioCodec: T.Optional(
    T.Union(Object.keys(audioEncoders).map((e) => T.Literal(e)))
  ),
  audioFilters: T.Optional(
    T.Union(Object.keys(audioFilters).map((f) => T.Literal(f)))
  ),
  autopad: T.Optional(T.Union([T.Boolean(), T.String()])),
  aspect: T.Optional(T.Union([T.String(), T.Number()])),
  format: T.Optional(
    T.Union(Object.keys(outputFormats).map((f) => T.Literal(f)))
  ),
  fps: T.Optional(T.Number()),
  output: T.Optional(T.String()),
  seek: T.Optional(T.Union([T.String(), T.Number()])),
  size: T.Optional(T.Union([T.String()])),
  videoBitrate: T.Optional(T.Union([T.String(), T.Number()])),
  videoBitrateConstant: T.Optional(T.Boolean()),
  videoCodec: T.Optional(
    T.Union(Object.keys(videoEncoders).map((e) => T.Literal(e)))
  ),
  videoFilters: T.Optional(
    T.Union(Object.keys(videoFilters).map((f) => T.Literal(f)))
  ),
  options: T.Optional(T.String()),
});

export type OptimizerOptions = StaticDecode<typeof optionsSchema>;

const extensionMap = {
  matroska: "mkv",
};

export async function optimizeVideo(
  opts: OptimizerOptions,
  input: ReadableStream
) {
  const uuid = Bun.randomUUIDv7("base64url");
  const outPath =
    opts.output ?? `/tmp/output-${uuid}.${extensionMap[opts.format!] ?? "mp4"}`;
  const inputPath = `/tmp/input-${uuid}.mov`;
  try {
    await Bun.write(inputPath, await Bun.readableStreamToArrayBuffer(input));
    const proc = Bun.spawn(
      [
        ffmpegPath,
        "-y",
        "-i",
        inputPath,
        "-c:v",
        opts.videoCodec ?? "copy",
        "-c:a",
        opts.audioCodec ?? "copy",
        outPath,
      ],
      { stderr: "pipe" }
    );
    const out = Bun.readableStreamToText(proc.stderr);

    const code = await proc.exited;
    if (code !== 0)
      throw new Error(`ffmpeg exited with code ${code}\n${await out}`);
  } finally {
    await Bun.file(inputPath).unlink();
  }

  if (!opts.output) return Bun.file(outPath);
}

export const videoQueue = new Queue({
  parallelize: Number(Bun.env.VIDEO_PARALLELIZE ?? 1),
  max: Number(Bun.env.VIDEO_QUEUE_SIZE ?? 5),
});
