import type { Writable } from "stream";

export async function exhaustAsyncIterableToWritable(
  it: AsyncIterable<Uint8Array>,
  writable: Writable
) {
  for await (const chunk of it) {
    if (!writable.write(chunk))
      await new Promise((resolve) => writable.once("drain", resolve));
  }
  writable.end();
  await new Promise((resolve) => writable.on("finish", resolve));
}
