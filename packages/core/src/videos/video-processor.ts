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
      let args = [] as { args: string[]; ext: string }[];
      for (const o of Array.isArray(opts) ? opts : [opts]) {
        const a = [] as string[];
        if (o.frames) a.push("-frames:v", o.frames.toString());
        if (o.format) a.push("-f", o.format);
        if (o.seek) a.push("-ss", o.seek.toString());
        if (o.duration) a.push("-t", o.duration.toString());
        if (o.audioBitrate) a.push("-b:a", o.audioBitrate.toString());
        if (o.videoBitrate) a.push("-b:v", o.videoBitrate.toString());
        if (o.audioFilters) a.push("-af", o.audioFilters);
        if (o.videoFilters) a.push("-vf", o.videoFilters);
        if (o.complexFilters) a.push("-filter_complex", o.complexFilters);
        if (o.aspect) a.push("-aspect", o.aspect.toString());
        if (o.pad) a.push("-pad", o.pad);
        if (o.fps) a.push("-r", o.fps.toString());
        if (o.size) a.push("-scale", o.size);
        if (o.videoCodec) a.push("-c:v", o.videoCodec);
        if (o.audioCodec) a.push("-c:a", o.audioCodec);
        args.push({
          args: a,
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
