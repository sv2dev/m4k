import { Type as T } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { ProcessedFile, processVideo, type VideoOptions } from "m4k";
import { rm } from "node:fs/promises";
import { basename } from "node:path";
import { parseOpts } from "../util/request-parsing";
import { error, queueAndStream } from "../util/response";

export const optionsSchema = T.Object({
  audioBitrate: T.Optional(T.Union([T.String(), T.Number()])),
  audioCodec: T.Optional(T.String()),
  audioFilters: T.Optional(T.String()),
  autopad: T.Optional(T.Union([T.Boolean(), T.String()])),
  aspect: T.Optional(T.Union([T.String(), T.Number()])),
  inputFormat: T.Optional(T.String()),
  format: T.Optional(T.String()),
  fps: T.Optional(T.Number()),
  output: T.Optional(T.String()),
  seek: T.Optional(T.Union([T.String(), T.Number()])),
  size: T.Optional(T.Union([T.String()])),
  videoBitrate: T.Optional(T.Union([T.String(), T.Number()])),
  videoBitrateConstant: T.Optional(T.Boolean()),
  videoCodec: T.Optional(T.String()),
  videoFilters: T.Optional(T.String()),
  options: T.Optional(T.String()),
});

const compiledOptionsSchema = TypeCompiler.Compile(optionsSchema);

export async function processVideoHandler(request: Request) {
  if (!request.body) return error(400, "No body provided");
  let optsArr: (VideoOptions & { output?: string; name?: string })[];
  try {
    optsArr = parseOpts(request, compiledOptionsSchema);
  } catch (err) {
    return error(400, (err as RangeError).message);
  }
  if (optsArr.length === 0) return error(400, "No options provided");
  // Currently only one option is supported
  const [opts] = optsArr;
  const iterable = processVideo(request.body, opts, {
    signal: request.signal,
  });
  if (!iterable) return error(409, "Queue is full");

  return queueAndStream(
    (async function* () {
      for await (const value of iterable) {
        if (value instanceof ProcessedFile) {
          if (opts.output) {
            await Bun.write(Bun.file(opts.output), Bun.file(value.name));
            await rm(value.name, { force: true });
          } else {
            yield new ProcessedFile(
              opts.name ?? basename(value.name),
              value.type,
              value.stream ?? Bun.file(value.name).stream()
            );
          }
        } else {
          yield value;
        }
      }
    })()
  );
}
