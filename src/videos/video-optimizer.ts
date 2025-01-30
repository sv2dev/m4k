import { Type as T, type StaticDecode } from "@sinclair/typebox";
import ffmpeg from "fluent-ffmpeg";
import { promisify } from "node:util";

// ffmpeg.setFfmpegPath(path);

const [formats, encoders, filters] = await Promise.all([
  promisify(ffmpeg.getAvailableFormats)(),
  promisify(ffmpeg.getAvailableEncoders)(),
  promisify(ffmpeg.getAvailableFilters)(),
]);

export const audioEncoders = Object.entries(encoders)
  .filter(([_, e]) => e.type === "audio")
  .map(([name, { description }]) => ({ name, description }));
export const videoEncoders = Object.entries(encoders)
  .filter(([_, e]) => e.type === "video")
  .map(([name, { description }]) => ({ name, description }));
export const audioFilters = Object.entries(filters)
  .filter(([_, f]) => f.output === "audio")
  .map(([name, { description }]) => ({ name, description }));
export const videoFilters = Object.entries(filters)
  .filter(([_, f]) => f.output === "video")
  .map(([name, { description }]) => ({ name, description }));
export const outputFormats = Object.entries(formats)
  .filter(([_, f]) => f.canMux)
  .map(([name, { description }]) => ({ name, description }));

export const optionsSchema = T.Object({
  audioBitrate: T.Optional(T.Union([T.String(), T.Number()])),
  audioCodec: T.Optional(T.Union(audioEncoders.map((e) => T.Literal(e.name)))),
  audioFilters: T.Optional(T.Union(audioFilters.map((f) => T.Literal(f.name)))),
  autopad: T.Optional(T.Union([T.Boolean(), T.String()])),
  aspect: T.Optional(T.Union([T.String(), T.Number()])),
  format: T.Optional(T.Union(outputFormats.map((f) => T.Literal(f.name)))),
  fps: T.Optional(T.Number()),
  output: T.Optional(T.String()),
  seek: T.Optional(T.Union([T.String(), T.Number()])),
  size: T.Optional(T.Union([T.String()])),
  videoBitrate: T.Optional(T.Union([T.String(), T.Number()])),
  videoBitrateConstant: T.Optional(T.Boolean()),
  videoCodec: T.Optional(T.Union(videoEncoders.map((e) => T.Literal(e.name)))),
  videoFilters: T.Optional(T.Union(videoFilters.map((f) => T.Literal(f.name)))),
});

export type OptimizerOptions = StaticDecode<typeof optionsSchema>;

const extensionMap = {
  matroska: "mkv",
};

export async function optimizeVideo(
  opts: OptimizerOptions,
  input: ReadableStream
) {
  const outPath =
    opts.output ?? `/tmp/output.${extensionMap[opts.format!] ?? "mp4"}`;
  const inputPath = `/tmp/input${Date.now()}.mov`;
  try {
    await Bun.write(inputPath, await Bun.readableStreamToArrayBuffer(input));
    const proc = Bun.spawn(
      [
        "ffmpeg",
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
