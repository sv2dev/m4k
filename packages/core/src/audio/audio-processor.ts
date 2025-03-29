import { type AudioOptions } from "@m4k/common";
import { mkdir } from "node:fs/promises";
import { createQueue } from "tasque";
import { getExtension, processFfmpeg } from "../util/ffmpeg-processor";

/**
 * Process a video.
 * @param input - The input video. Can be a file path, a stream or a blob.
 * @param opts - The options for the video processing.
 * @param signal - An optional abort signal.
 * @returns An iterable of the processed videos.
 */
export function processAudio(
  input: string | AsyncIterable<Uint8Array> | Blob,
  opts: AudioOptions | AudioOptions[],
  { signal }: { signal?: AbortSignal } = {}
) {
  return processFfmpeg(
    input,
    () => {
      let args = [] as { input: string[]; out: string[]; ext: string }[];
      for (const o of Array.isArray(opts) ? opts : [opts]) {
        const inArgs = [] as string[];
        if (o.inputFormat) inArgs.push("-f", o.inputFormat);
        const outArgs = [] as string[];
        if (o.format) outArgs.push("-f", o.format);
        if (o.seek) outArgs.push("-ss", o.seek.toString());
        if (o.duration) outArgs.push("-t", o.duration.toString());
        if (o.bitrate) outArgs.push("-b:a", o.bitrate.toString());
        if (o.filters) outArgs.push("-af", o.filters);
        if (o.complexFilters) outArgs.push("-filter_complex", o.complexFilters);
        if (o.codec) outArgs.push("-c:a", o.codec);
        args.push({
          input: inArgs,
          out: outArgs,
          ext: o.ext ?? getExtension(o.format ?? "mp3"),
        });
      }
      return args;
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
