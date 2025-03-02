import type { BunFile } from "bun";
import { basename } from "node:path";
import { BOUNDARY, MultipartMixed } from "./multipart-mixed";

export function error(status: number, message: string) {
  return new Response(message, { status });
}

export function stream(readable: ReadableStream) {
  return new Response(readable, {
    headers: {
      "content-type": `multipart/mixed; boundary="${BOUNDARY}"`,
      "transfer-encoding": "chunked",
    },
  });
}

export async function queueAndStream(
  iterable: AsyncIterable<{} | BunFile | Blob>
) {
  const multipart = new MultipartMixed();
  iterate();
  return stream(multipart.stream);

  async function iterate() {
    const { reset, clear } = idle(() => {
      multipart.part({ payload: "keepalive" });
    }, KEEP_ALIVE_INTERVAL);
    try {
      for await (const x of iterable) {
        if ("stream" in x) {
          clear();
          multipart.part({
            contentType: x.type,
            filename: basename(x.name!),
          });
          for await (const chunk of x.stream() as unknown as AsyncIterable<Uint8Array>) {
            multipart.write(chunk);
          }
        } else {
          reset();
          multipart.part({ payload: x });
        }
      }
    } catch (err) {
      // err can be undefined, if the connection was aborted
      if (err) multipart.part({ payload: { error: (err as Error).message } });
    }
    await multipart.end();
  }
}

function idle(fn: (...args: any[]) => void, wait: number) {
  let interval: any;
  return {
    reset: (...args: any[]) => {
      clearInterval(interval);
      interval = setInterval(() => fn(...args), wait);
    },
    clear: () => {
      clearInterval(interval);
    },
  };
}

const MINUTES = 1000 * 60;
const KEEP_ALIVE_INTERVAL = Number(Bun.env.KEEP_ALIVE_INTERVAL ?? 1) * MINUTES;
