import type { Queue } from "@sv2dev/queue";
import { BOUNDARY, MultipartMixed } from "./multipart-mixed";

export function error(status: number, message: string) {
  return new Response(message, { status });
}

export function json(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });
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
  queue: Queue,
  task: (multipart: MultipartMixed) => Promise<void>,
  prepare?: (multipart: MultipartMixed) => Promise<void>,
  abortSignal?: AbortSignal
) {
  const multipart = new MultipartMixed();
  let preparing: Promise<void> | undefined;
  const iterable = queue.pushAndIterate(async () => {
    await preparing;
    try {
      await task(multipart);
    } catch (err) {
      // err can be undefined, if the connection was aborted
      if (err) multipart.part({ payload: { error: (err as Error).message } });
    }
    if (!abortSignal || !abortSignal.aborted) {
      await multipart.end();
    }
  });
  if (!iterable) error(503, "Queue is full");
  if (prepare) {
    preparing = prepare(multipart);
    await preparing;
  }
  streamQueuePosition();
  return stream(multipart.stream);

  async function streamQueuePosition() {
    const { reset, clear } = idle(() => {
      multipart.part({ payload: "keepalive" });
    }, KEEP_ALIVE_INTERVAL);
    abortSignal?.addEventListener("abort", clear);
    for await (const [position] of iterable!) {
      if (position) {
        reset();
        multipart.part({ payload: { position } });
      } else {
        clear();
      }
    }
  }
}

function idle(fn: (...args: any[]) => void, wait: number) {
  let interval: any;
  return {
    reset: (...args: any[]) => {
      clearInterval(interval);
      interval = setInterval(() => fn(...args), wait);
    },
    clear: () => clearInterval(interval),
  };
}

const MINUTES = 1000 * 60;
const KEEP_ALIVE_INTERVAL = Number(Bun.env.KEEP_ALIVE_INTERVAL ?? 1) * MINUTES;
