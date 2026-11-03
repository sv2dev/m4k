import { imageClassifier, validateClassificationOptions } from "@m4k/common";
import { classifyImage } from "m4k";

/** Admission validates options before reading bytes; body is bounded even without Content-Length. */
export async function classifyImageHandler(request: Request): Promise<Response> {
  let options: unknown;
  try {
    options = JSON.parse(request.headers.get("X-Options") ?? "null");
  } catch {
    return new Response("Invalid classification options", { status: 400 });
  }
  if (!validateClassificationOptions(options))
    return new Response("Unsupported classifier configuration", { status: 422 });
  if (!request.body) return new Response("No preview provided", { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request.body) {
    size += chunk.byteLength;
    if (size > imageClassifier.maxBytes)
      return new Response("Preview exceeds byte limit", { status: 413 });
    chunks.push(chunk);
  }
  try {
    return Response.json(
      await classifyImage(Buffer.concat(chunks), options, { signal: request.signal }),
    );
  } catch (error) {
    if (request.signal.aborted) return new Response("Cancelled", { status: 499 });
    if (error instanceof RangeError) return new Response(error.message, { status: 422 });
    if (error instanceof Error && error.message === "Classifier is busy")
      return new Response(error.message, { status: 429 });
    return new Response("Classification failed", { status: 503 });
  }
}
