import { TypeCompiler } from "@sinclair/typebox/compiler";
import { parse } from "../util/typebox";
import {
  audioEncoders,
  audioFilters,
  inputFormats,
  optimizeVideo,
  optionsSchema,
  outputFormats,
  videoEncoders,
  videoFilters,
} from "./video-optimizer";

const compiledParamsSchema = TypeCompiler.Compile(optionsSchema);

export async function processVideo(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const opts = parse(compiledParamsSchema, params);
  const video = await optimizeVideo(opts, req.body!);
  if (!video) return new Response(undefined, { status: 201 });
  const { readable, writable } = new TransformStream();
  video
    .stream()
    .pipeTo(writable)
    .then(async () => {
      try {
        await video.unlink();
      } catch (error) {
        console.error("Cleanup failed:", error);
      }
    });
  const res = new Response(readable, {
    headers: { "Content-Type": video.type },
  });
  return res;
}

export function getSupportedInputFormats() {
  return Response.json(inputFormats);
}

export function getSupportedOutputFormats() {
  return Response.json(outputFormats);
}

export function getSupportedAudioEncoders() {
  return Response.json(audioEncoders);
}

export function getSupportedVideoEncoders() {
  return Response.json(videoEncoders);
}

export function getSupportedAudioFilters() {
  return Response.json(audioFilters);
}

export function getSupportedVideoFilters() {
  return Response.json(videoFilters);
}
