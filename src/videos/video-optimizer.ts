import { Type as T, type StaticDecode } from "@sinclair/typebox";
import { spawn, type BunFile } from "bun";
import { createQueue } from "tasque";
import { ffmpeg } from "./video-utils";

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

export type VideoOptimizerOptions = StaticDecode<typeof optionsSchema>;

export const extMap: Record<string, string> = {
  matroska: "mkv",
};

export function optimizeVideo(
  input: BunFile,
  opts: VideoOptimizerOptions,
  signal?: AbortSignal
) {
  const iterable = videoQueue.iterate(async function* () {
    const output = Bun.file(
      opts.output ?? input.name!.replace("input", "output")
    );

    const vc = opts.videoCodec ?? "copy";
    const ac = opts.audioCodec ?? "copy";

    const child = spawn(
      [
        ffmpeg,
        "-y",
        "-i",
        input.name!,
        ...(ac ? ["-c:a", ac] : []),
        ...(vc ? ["-c:v", vc] : []),
        output.name!,
      ],
      { stderr: "pipe", signal }
    );
    const decoder = new TextDecoder();

    let metadataStr = "";
    let duration: number | null = null;
    let progress = 0;
    let errStr = "";
    for await (const chunk of child.stderr as any as AsyncIterable<Uint8Array>) {
      const str = decoder.decode(chunk);
      errStr += str;
      if (duration === null) {
        metadataStr += str;
        duration = parseDuration(metadataStr);
        if (duration === null) {
          metadataStr = str.slice(-30);
          continue;
        }
        yield { progress };
        continue;
      }
      const match = str.match(/time=(\S+)/);
      if (match) {
        const time = durationToMs(match[1]);
        const p = Math.round((time / duration) * 100);
        if (p !== progress) {
          progress = p;
          yield { progress };
        }
      }
    }

    const code = await child.exited;
    if (code !== 0) {
      throw new Error(`ffmpeg exited with code ${code}: ${errStr}`);
    }

    if (!opts.output) {
      yield output;
      await output.unlink();
    }
  }, signal);
  if (!iterable) return null;
  return (async function* () {
    for await (const [position, value] of iterable) {
      if (position !== null) yield { position };
      else yield value;
    }
  })();
}

function parseDuration(metadataStr: string) {
  const match = metadataStr.match(/Duration: (\d+:\d+:\d+\.\d+)/);
  if (!match) return null;
  return durationToMs(match[1]);
}

function durationToMs(duration: string) {
  const [, hours, minutes, seconds, centiseconds] =
    duration.match(/(\d+):(\d+):(\d+)\.(\d+)/)?.map(Number) ?? [];
  return (((hours * 60 + minutes) * 60 + seconds) * 100 + centiseconds) * 10;
}

const videoQueue = createQueue({
  parallelize: Number(Bun.env.VIDEO_PARALLELIZE ?? 1),
  max: Number(Bun.env.VIDEO_QUEUE_SIZE ?? 5),
});
