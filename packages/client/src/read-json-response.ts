/** Capabilities and classifier annotations are bounded JSON, not media streams. */
export async function readJsonResponse(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("Empty M4K JSON response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 65536) throw new Error("M4K JSON response exceeds 64 KiB");
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}
