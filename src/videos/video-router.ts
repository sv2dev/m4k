import { TypeCompiler } from "@sinclair/typebox/compiler";
import { parseOpts } from "../util/request-parsing";
import { error, json, queueAndStream } from "../util/response";
import {
  optimizeVideo,
  optionsSchema,
  type VideoOptimizerOptions,
} from "./video-optimizer";
import {
  getAudioEncoders,
  getAudioFilters,
  getExtension,
  getInputFormats,
  getOutputFormats,
  getVideoEncoders,
  getVideoFilters,
} from "./video-utils";

const compiledOptionsSchema = TypeCompiler.Compile(optionsSchema);

export async function processVideo(request: Request) {
  let opts: VideoOptimizerOptions | undefined;
  try {
    [opts] = parseOpts(request, compiledOptionsSchema);
  } catch (err) {
    return error(400, (err as RangeError).message);
  }
  if (!opts) return error(400, "No options provided");
  const inputFile = Bun.file(
    `/tmp/input-${Bun.randomUUIDv7("base64url")}.${getExtension(
      opts.inputFormat ?? "mp4"
    )}`
  );
  const writer = inputFile.writer();
  for await (const chunk of request.body as unknown as AsyncIterable<Uint8Array>) {
    writer.write(chunk);
    await writer.flush();
  }
  await writer.end();
  const generator = optimizeVideo(inputFile, opts, request.signal);
  if (!generator) return error(409, "Queue is full");

  return queueAndStream(
    (async function* () {
      try {
        yield* generator();
      } finally {
        await inputFile.unlink();
      }
    })()
  );
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
