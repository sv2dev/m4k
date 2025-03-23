import { type AudioOptions } from "@m4k/common";
import { mkdir } from "node:fs/promises";
import { createQueue } from "tasque";
import { processFfmpeg } from "../util/ffmpeg-processor";

/**
 * Process a video.
 * @param input - The input video. Can be a file path, a stream or a blob.
 * @param opts - The options for the video processing.
 * @param signal - An optional abort signal.
 * @returns An iterable of the processed videos.
 */
export function processAudio(
  input: string | AsyncIterable<Uint8Array> | Blob,
  opts: AudioOptions,
  { signal }: { signal?: AbortSignal } = {}
) {
  return processFfmpeg(
    input,
    () => {
      const inArgs = [] as string[];
      if (opts.inputFormat) inArgs.push("-f", opts.inputFormat);
      if (opts.seek) inArgs.push("-ss", opts.seek.toString());
      if (opts.duration) inArgs.push("-t", opts.duration.toString());
      const outArgs = [] as string[];
      if (opts.format) outArgs.push("-f", opts.format);
      if (opts.bitrate) outArgs.push("-b:a", opts.bitrate.toString());
      if (opts.filters) outArgs.push("-af", opts.filters);
      if (opts.complexFilters)
        outArgs.push("-filter_complex", opts.complexFilters);
      outArgs.push("-c:a", opts.codec ?? "copy");
      return {
        input: inArgs,
        out: outArgs,
        format: opts.format ?? "mp4",
      };
    },
    { signal, queue: audioQueue, tmpDir }
  );
}

/**
 * The queue for video processing.
 */
export const audioQueue = createQueue({
  parallelize: Number(process.env.AUDIO_PARALLELIZE ?? 1),
  max: Number(process.env.AUDIO_QUEUE_SIZE ?? 5),
});

const tmpDir = `${process.env.M4K_TMP_DIR ?? "/tmp/m4k"}/audio`;

await mkdir(tmpDir, { recursive: true });
