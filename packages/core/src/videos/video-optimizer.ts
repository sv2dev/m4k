import { ConvertedFile, type VideoOptimizerOptions } from "@m4k/common";
import { spawn } from "node:child_process";
import { getRandomValues } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { createQueue } from "tasque";
import { mimeTypes } from "../util/mime";

export function optimizeVideo(
  inputPath: string,
  opts: VideoOptimizerOptions,
  signal?: AbortSignal
) {
  const iterable = videoQueue.iterate(async function* () {
    await mkdir(tmpVideoDir, { recursive: true });
    const outputPath = `${tmpVideoDir}/out-${Buffer.from(
      getRandomValues(new Uint8Array(16))
    ).toString("base64url")}.${getExtension(opts.format ?? "mp4")}`;

    const inArgs = [] as string[];
    if (opts.inputFormat) inArgs.push("-f", opts.inputFormat);
    if (opts.seek) inArgs.push("-ss", opts.seek.toString());
    if (opts.duration) inArgs.push("-t", opts.duration.toString());
    const outArgs = [] as string[];
    if (opts.format) outArgs.push("-f", opts.format);
    if (opts.audioBitrate) outArgs.push("-b:a", opts.audioBitrate.toString());
    if (opts.videoBitrate) outArgs.push("-b:v", opts.videoBitrate.toString());
    if (opts.audioFilters) outArgs.push("-af", opts.audioFilters);
    if (opts.videoFilters) outArgs.push("-vf", opts.videoFilters);
    if (opts.complexFilters)
      outArgs.push("-filter_complex", opts.complexFilters);
    if (opts.aspect) outArgs.push("-aspect", opts.aspect.toString());
    if (opts.pad) outArgs.push("-pad", opts.pad);
    if (opts.fps) outArgs.push("-r", opts.fps.toString());
    if (opts.size) outArgs.push("-scale", opts.size);
    outArgs.push("-c:v", opts.videoCodec ?? "copy");
    outArgs.push("-c:a", opts.audioCodec ?? "copy");

    try {
      const child = spawn(
        ffmpeg,
        ["-y", ...inArgs, "-i", inputPath, ...outArgs, outputPath],
        { stdio: ["pipe", "pipe", "pipe"], signal }
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
        const match = str.match(/time=(\d\d:\d\d:\d\d.\d\d)/);
        if (match) {
          const time = durationToMs(match[1]);
          const p = Math.round((time / duration) * 100);
          if (p !== progress) {
            progress = p;
            yield { progress };
          }
        }
      }
      if (progress !== 100) {
        yield { progress: 100 };
      }

      const code = await new Promise<number>((resolve) => {
        child.on("close", resolve);
      });
      if (code !== 0) {
        throw new Error(`ffmpeg exited with code ${code}: ${errStr}`);
      }
      yield new ConvertedFile(outputPath, mimeTypes[opts.format ?? "mp4"]);
    } finally {
      await rm(outputPath, { force: true });
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

/**
 * Get the extension for a given format.
 * May not be complete yet. Most of the time, the format will be the same as the extension.
 * @param format - The format to get the extension for.
 * @returns The extension for the given format.
 */
export function getExtension(format: string) {
  return extMap[format] ?? format;
}

export const videoQueue = createQueue({
  parallelize: Number(process.env.VIDEO_PARALLELIZE ?? 1),
  max: Number(process.env.VIDEO_QUEUE_SIZE ?? 5),
});

export const tmpVideoDir = `${process.env.TMP_DIR ?? "/tmp"}/videos`;

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

const ffmpeg =
  process.env.FFMPEG_PATH ?? (await import("@ffmpeg-installer/ffmpeg")).path;

const extMap: Record<string, string> = {
  matroska: "mkv",
};
