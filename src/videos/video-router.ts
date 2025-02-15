import { TypeCompiler } from "@sinclair/typebox/compiler";
import { extname } from "node:path";
import { parseOpts } from "../util/request-parsing";
import { error, json, queueAndStream } from "../util/response";
import {
  optimizeVideo,
  optionsSchema,
  videoQueue,
  type OptimizerOptions,
} from "./video-optimizer";
import {
  getAudioEncoders,
  getAudioFilters,
  getInputFormats,
  getOutputFormats,
  getVideoEncoders,
  getVideoFilters,
} from "./video-utils";

const compiledOptionsSchema = TypeCompiler.Compile(optionsSchema);

export async function processVideo(request: Request) {
  let opts: OptimizerOptions | undefined;
  try {
    [opts] = parseOpts(request, compiledOptionsSchema);
  } catch (err) {
    return error(400, (err as RangeError).message);
  }
  if (!opts) {
    return error(400, "No options provided");
  }
  return queueAndStream(videoQueue, async (multipart) => {
    const video = await optimizeVideo(opts, request.body!);
    if (!video) return;
    await multipart.part({
      contentType: video.type,
      filename: `video${extname(video.name!)}`,
    });
    try {
      for await (const chunk of video.stream() as unknown as AsyncIterable<Uint8Array>) {
        await multipart.write(chunk);
      }
    } catch (error) {
      console.error("Error streaming video:", error);
      await multipart.part({ payload: { error: (error as Error).message } });
    }
    try {
      await video.unlink();
    } catch (error) {
      console.warn("Cleanup failed:", error);
    }
  });
}

export async function getSupportedVideoEncoders() {
  return json(await getVideoEncoders());
}

export async function getSupportedVideoFilters() {
  return json(await getVideoFilters());
}

export async function getSupportedAudioEncoders() {
  return json(await getAudioEncoders());
}

export async function getSupportedAudioFilters() {
  return json(await getAudioFilters());
}

export async function getSupportedInputFormats() {
  return json(await getInputFormats());
}

export async function getSupportedOutputFormats() {
  return json(await getOutputFormats());
}
