import { Type as T, type StaticDecode } from "@sinclair/typebox";
import { Queue } from "@sv2dev/queue";
import { ffmpegPath } from "./video-utils";

export const optionsSchema = T.Object({
  audioBitrate: T.Optional(T.Union([T.String(), T.Number()])),
  audioCodec: T.Optional(T.String()),
  audioFilters: T.Optional(T.String()),
  autopad: T.Optional(T.Union([T.Boolean(), T.String()])),
  aspect: T.Optional(T.Union([T.String(), T.Number()])),
  inputFormat: T.Optional(T.String()),
  format: T.Optional(T.String()),
  fps: T.Optional(T.Number()),
  output: T.Optional(T.String()),
  seek: T.Optional(T.Union([T.String(), T.Number()])),
  size: T.Optional(T.Union([T.String()])),
  videoBitrate: T.Optional(T.Union([T.String(), T.Number()])),
  videoBitrateConstant: T.Optional(T.Boolean()),
  videoCodec: T.Optional(T.String()),
  videoFilters: T.Optional(T.String()),
  options: T.Optional(T.String()),
});

export type OptimizerOptions = StaticDecode<typeof optionsSchema>;

const extMap: Record<string, string> = {
  matroska: "mkv",
};

export async function optimizeVideo(
  opts: OptimizerOptions,
  input: ReadableStream
) {
  const uuid = Bun.randomUUIDv7("base64url");
  const inputFormat = extMap[opts.inputFormat!] ?? opts.inputFormat ?? "mp4";
  const outputFormat = extMap[opts.format!] ?? opts.format ?? "mp4";
  const outPath = opts.output ?? `/tmp/output-${uuid}.${outputFormat}`;
  const inputPath = `/tmp/input-${uuid}.${inputFormat}`;
  try {
    const file = Bun.file(inputPath);
    const writer = file.writer();
    for await (const chunk of input as unknown as AsyncIterable<Uint8Array>) {
      writer.write(chunk);
    }
    await writer.flush();

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
