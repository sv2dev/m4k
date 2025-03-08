import { Readable } from "node:stream";

export function readableFromWeb(stream: ReadableStream) {
  // Currently node types don't match with TS lib types for ReadableStream, so we need to cast to any.
  return Readable.fromWeb(stream as any);
}

export function readableToWeb(stream: Readable) {
  return Readable.toWeb(stream) as unknown as ReadableStream &
    AsyncIterable<Uint8Array>;
}
