import { BOUNDARY } from "./multipart-mixed";

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
