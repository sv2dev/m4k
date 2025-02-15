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

export function queueAndStream(
  queue: Queue,
  task: (multipart: MultipartMixed) => Promise<void>
) {
  const multipart = new MultipartMixed();
  const iterable = queue.pushAndIterate(async () => {
    await task(multipart);
    await multipart.end();
  });
  if (!iterable) error(503, "Queue is full");
  streamQueuePosition();
  return stream(multipart.stream);

  async function streamQueuePosition() {
    for await (const [position] of iterable!) {
      if (position) {
        multipart.part({ payload: { position } });
      }
    }
  }
}
