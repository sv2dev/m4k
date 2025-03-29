import { type VideoOptions } from "@m4k/common";
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
export function processVideo(
  input: string | AsyncIterable<Uint8Array> | Blob,
  opts: VideoOptions | VideoOptions[],
  { signal }: { signal?: AbortSignal } = {}
) {
  return processFfmpeg(
    input,
    () => {
      let args = [] as { input: string[]; out: string[]; ext: string }[];
      for (const o of Array.isArray(opts) ? opts : [opts]) {
        const inArgs = [] as string[];
        if (o.inputFormat) inArgs.push("-f", o.inputFormat);
        if (o.seek) inArgs.push("-ss", o.seek.toString());
        if (o.duration) inArgs.push("-t", o.duration.toString());
        const outArgs = [] as string[];
        if (o.frames) outArgs.push("-frames:v", o.frames.toString());
        if (o.format) outArgs.push("-f", o.format);
        if (o.audioBitrate) outArgs.push("-b:a", o.audioBitrate.toString());
        if (o.videoBitrate) outArgs.push("-b:v", o.videoBitrate.toString());
        if (o.audioFilters) outArgs.push("-af", o.audioFilters);
        if (o.videoFilters) outArgs.push("-vf", o.videoFilters);
        if (o.complexFilters) outArgs.push("-filter_complex", o.complexFilters);
        if (o.aspect) outArgs.push("-aspect", o.aspect.toString());
        if (o.pad) outArgs.push("-pad", o.pad);
        if (o.fps) outArgs.push("-r", o.fps.toString());
        if (o.size) outArgs.push("-scale", o.size);
        if (o.videoCodec) outArgs.push("-c:v", o.videoCodec);
        if (o.audioCodec) outArgs.push("-c:a", o.audioCodec);
        args.push({
          input: inArgs,
          out: outArgs,
          ext: o.ext ?? getExtension(o.format ?? "mp4"),
        });
      }
      return args;
    },
    { signal, queue: videoQueue, tmpDir }
  );
}

/**
 * The queue for video processing.
 */
export const videoQueue = createQueue({
  parallelize: Number(process.env.VIDEO_PARALLELIZE ?? 1),
  max: Number(process.env.VIDEO_QUEUE_SIZE ?? 5),
});

const tmpDir = `${process.env.M4K_TMP_DIR ?? "/tmp/m4k"}/video`;

await mkdir(tmpDir, { recursive: true });
