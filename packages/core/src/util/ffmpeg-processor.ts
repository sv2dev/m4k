import { ProcessedFile } from "@m4k/common";
import { spawn } from "node:child_process";
import { getRandomValues } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { type Tasque } from "tasque";
import { mimeTypes } from "../util/mime";
import { exhaustAsyncIterableToWritable } from "../util/streams";

/**
 * Process a video.
 * @param input - The input video. Can be a file path, a stream or a blob.
 * @param opts - The options for the video processing.
 * @param signal - An optional abort signal.
 * @returns An iterable of the processed videos.
 */
export function processFfmpeg(
  input: string | AsyncIterable<Uint8Array> | Blob,
  buildArgs: () => { input: string[]; out: string[]; format: string },
  {
    signal,
    queue,
    tmpDir,
  }: { signal?: AbortSignal; queue: Tasque; tmpDir: string }
) {
  const id = randomId();
  const inputPath =
    typeof input === "string" ? input : createTmp(tmpDir, id, input);
  const iterable = queue.iterate(async function* () {
    const { input: inArgs, out: outArgs, format } = buildArgs();
    const outputPath = `${tmpDir}/out-${id}.${getExtension(format)}`;
    try {
      const child = spawn(
        ffmpeg,
        ["-y", ...inArgs, "-i", await inputPath, ...outArgs, outputPath],
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
      yield new ProcessedFile(outputPath, mimeTypes[format]);
    } finally {
      await rm(outputPath, { force: true });
      if (typeof inputPath !== "string") {
        await rm(await inputPath, { force: true });
      }
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

async function createTmp(
  tmpDir: string,
  id: string,
  input: AsyncIterable<Uint8Array<ArrayBufferLike>> | Blob
) {
  const filePath = `${tmpDir}/in-${id}`;
  const writer = createWriteStream(filePath);
  await exhaustAsyncIterableToWritable(
    "stream" in input ? input.stream() : input,
    writer
  );
  return filePath;
}

function randomId() {
  return Buffer.from(getRandomValues(new Uint8Array(16))).toString("base64url");
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

const ffmpeg =
  process.env.FFMPEG_PATH ?? (await import("@ffmpeg-installer/ffmpeg")).path;

const extMap: Record<string, string> = {
  matroska: "mkv",
};
