import { type VideoOptions } from "@m4k/common";
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
export function processVideo(
  input: string | AsyncIterable<Uint8Array> | Blob,
  opts: VideoOptions,
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
      return {
        input: inArgs,
        out: outArgs,
        format: opts.format ?? "mp4",
      };
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
