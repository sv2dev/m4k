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
      let args = [] as { args: string[]; ext: string }[];
      for (const o of Array.isArray(opts) ? opts : [opts]) {
        const a = [] as string[];
        if (o.format) a.push("-f", o.format);
        if (o.seek) a.push("-ss", o.seek.toString());
        if (o.duration) a.push("-t", o.duration.toString());
        if (o.bitrate) a.push("-b:a", o.bitrate.toString());
        if (o.filters) a.push("-af", o.filters);
        if (o.complexFilters) a.push("-filter_complex", o.complexFilters);
        if (o.codec) a.push("-c:a", o.codec);
        args.push({
          args: a,
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
