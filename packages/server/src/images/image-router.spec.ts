import type {
  ImageOptimizerOptions,
  ProcessingError,
  Progress,
  QueuePosition,
} from "@m4k/types";
import { streamParts } from "@sv2dev/multipart-stream";
import { describe, expect, it } from "bun:test";
import { server } from "../server";

const fixture = Bun.file("../../fixtures/image.jpeg");

describe("/process", () => {
  it("should process a single image", async () => {
    const query = new URLSearchParams({
      width: "100",
      height: "1000",
      format: "jpeg",
    });
    const response = await server.fetch(
      new Request(`http://localhost:3000/images/process?${query}`, {
        method: "POST",
        body: fixture,
      })
    );

    expect(response.status).toBe(200);
    const collected = await collectResponse(response);

    expect(collected).toEqual([
      { position: 0 },
      { progress: 0 },
      { filename: "file1.jpeg", type: "image/jpeg", size: 704 },
      { progress: 100 },
    ]);
  }, 1000);

  it("should stream the queue position", async () => {
    const query = new URLSearchParams({
      width: "100",
      height: "1000",
    });
    const r1 = server.fetch(
      new Request(`http://localhost:3000/images/process?${query}`, {
        method: "POST",
        body: fixture,
      })
    );
    const r2 = server.fetch(
      new Request(`http://localhost:3000/images/process?${query}`, {
        method: "POST",
        body: fixture,
      })
    );

    const collected1 = await collectResponse(await r1);
    const collected2 = await collectResponse(await r2);

    expect(collected1).toEqual([
      { position: 0 },
      { progress: 0 },
      { filename: "file1.avif", type: "image/avif", size: 500 },
      { progress: 100 },
    ]);
    expect(collected2).toEqual([
      { position: 0 },
      { progress: 0 },
      { filename: "file1.avif", type: "image/avif", size: 500 },
      { progress: 100 },
    ]);
  });

  it("should throw if format is invalid", async () => {
    const query = new URLSearchParams({ format: "x" });
    const res = await server.fetch(
      new Request(`http://localhost:3000/images/process?${query}`, {
        method: "POST",
        body: fixture,
      })
    );

    expect(res.status).toBe(400);
    expect(await res.text()).toEqual("[/format] Expected union value");
  });

  it("should return 400 if no options are provided", async () => {
    const res = await server.fetch(
      new Request(`http://localhost:3000/images/process`, {
        method: "POST",
        body: fixture,
      })
    );

    expect(res.status).toBe(400);
    expect(await res.text()).toBe("No options provided");
  });

  it("should return 400 if X-Options header is not valid JSON", async () => {
    const res = await server.fetch(
      new Request(`http://localhost:3000/images/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": "{" },
      })
    );

    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Error while parsing options");
  });

  it("should process multiple images", async () => {
    const response = await server.fetch(
      new Request(`http://localhost:3000/images/process`, {
        method: "POST",
        body: fixture,
        headers: {
          "X-Options": JSON.stringify([
            {
              resize: { width: 100, height: 100 },
              format: "avif",
              quality: 40,
            },
            {
              resize: { width: 100, height: 100 },
              format: "webp",
              quality: 40,
            },
          ] satisfies ImageOptimizerOptions[]),
        },
      })
    );

    const collected = await collectResponse(response);

    expect(response.status).toBe(200);
    expect(collected).toEqual([
      { position: 0 },
      { progress: 0 },
      { filename: "file1.avif", type: "image/avif", size: 457 },
      { progress: 50 },
      { filename: "file2.webp", type: "image/webp", size: 204 },
      { progress: 100 },
    ]);
  });
});

async function collectResponse(response: Response) {
  const collected: (
    | QueuePosition
    | Progress
    | ProcessingError
    | { filename: string; type: string; size: number }
  )[] = [];
  for await (const part of streamParts(response)) {
    if (part.type === "application/json") {
      collected.push(
        (await part.json()) as QueuePosition | Progress | ProcessingError
      );
    } else if (part.type === "text/plain") {
      continue; // keepalive
    } else {
      const bytes = await part.bytes();
      collected.push({
        filename: part.filename!,
        type: part.type!,
        size: bytes.length,
      });
    }
  }
  return collected;
}
