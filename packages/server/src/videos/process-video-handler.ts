import { videoOptionsSchema } from "@m4k/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { ProcessedFile, processVideo, type VideoOptions } from "m4k";
import { rm } from "node:fs/promises";
import { basename } from "node:path";
import { parseOpts } from "../util/request-parsing";
import { error, queueAndStream } from "../util/response";

const compiledOptionsSchema = TypeCompiler.Compile(videoOptionsSchema);

export async function processVideoHandler(request: Request) {
  if (!request.body) return error(400, "No body provided");
  let opts: (VideoOptions & { output?: string; name?: string })[];
  try {
    opts = parseOpts(request, compiledOptionsSchema);
  } catch (err) {
    return error(400, (err as RangeError).message);
  }
  if (opts.length === 0) return error(400, "No options provided");
  const iterable = processVideo(request.body, opts, {
    signal: request.signal,
  });
  if (!iterable) return error(409, "Queue is full");

  return queueAndStream(
    (async function* () {
      let idx = 0;
      for await (const value of iterable) {
        if (value instanceof ProcessedFile) {
          const { output, name } = opts[idx];
          if (output) {
            await Bun.write(Bun.file(output), Bun.file(value.name));
            await rm(value.name, { force: true });
          } else {
            yield new ProcessedFile(
              name ?? basename(value.name),
              value.type,
              value.stream ?? Bun.file(value.name).stream()
            );
          }
          idx++;
        } else {
          yield value;
        }
      }
    })()
  );
}
