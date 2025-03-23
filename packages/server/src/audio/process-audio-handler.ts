import { Type as T } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { ProcessedFile, processAudio, type AudioOptions } from "m4k";
import { rm } from "node:fs/promises";
import { basename } from "node:path";
import { parseOpts } from "../util/request-parsing";
import { error, queueAndStream } from "../util/response";

export const optionsSchema = T.Object({
  bitrate: T.Optional(T.Union([T.String(), T.Number()])),
  codec: T.Optional(T.String()),
  complexFilters: T.Optional(T.String()),
  filters: T.Optional(T.String()),
  duration: T.Optional(T.Union([T.String(), T.Number()])),
  format: T.Optional(T.String()),
  inputFormat: T.Optional(T.String()),
  seek: T.Optional(T.Union([T.String(), T.Number()])),
  name: T.Optional(T.String()),
  output: T.Optional(T.String()),
  options: T.Optional(T.String()),
});

const compiledOptionsSchema = TypeCompiler.Compile(optionsSchema);

export async function processAudioHandler(request: Request) {
  if (!request.body) return error(400, "No body provided");
  let optsArr: (AudioOptions & { output?: string; name?: string })[];
  try {
    optsArr = parseOpts(request, compiledOptionsSchema);
  } catch (err) {
    return error(400, (err as RangeError).message);
  }
  if (optsArr.length === 0) return error(400, "No options provided");
  // Currently only one option is supported
  const [opts] = optsArr;
  const iterable = processAudio(request.body, opts, {
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
