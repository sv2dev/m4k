import { Readable } from "node:stream";

// Currently bun / node types don't match with TS lib types for ReadableStream, so we need to cast to any.
export function readableFromWeb(stream: ReadableStream) {
  return Readable.fromWeb(stream as any);
}

export function readableToWeb(stream: Readable) {
  return Readable.toWeb(stream) as unknown as ReadableStream;
}
