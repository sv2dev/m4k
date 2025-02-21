import { TypeCompiler } from "@sinclair/typebox/compiler";
import { basename } from "node:path";
import { parseOpts } from "../util/request-parsing";
import { error, json, queueAndStream } from "../util/response";
import {
  optimizeVideo,
  optionsSchema,
  videoQueue,
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
  if (!opts) {
    return error(400, "No options provided");
  }
  const inputFile = Bun.file(
    `/tmp/input-${Bun.randomUUIDv7("base64url")}.${getExtension(
      opts.inputFormat ?? "mp4"
    )}`
  );
  return queueAndStream(
    videoQueue,
    async (multipart) => {
      try {
        for await (const x of optimizeVideo(opts, inputFile, request.signal)) {
          if ("progress" in x) {
            await multipart.part({ payload: x });
          } else {
            await multipart.part({
              contentType: x.type,
              filename: basename(x.name!),
            });
            for await (const chunk of x.stream() as unknown as AsyncIterable<Uint8Array>) {
              await multipart.write(chunk);
            }
          }
        }
      } finally {
        await inputFile.unlink();
      }
    },
    async () => {
      const writer = inputFile.writer();
      for await (const chunk of request.body as unknown as AsyncIterable<Uint8Array>) {
        writer.write(chunk);
        await writer.flush();
      }
      await writer.end();
    }
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
