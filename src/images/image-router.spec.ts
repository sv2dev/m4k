import { streamParts } from "@sv2dev/multipart-stream";
import { describe, expect, it } from "bun:test";
import { server } from "../server";
import type { OptimizerOptions } from "./image-optimizer";

describe("/process", () => {
  it("should process a single image", async () => {
    const query = new URLSearchParams({
      width: "100",
      height: "1000",
    });
    const response = await server.fetch(
      new Request(`http://localhost:3000/images/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
      })
    );

    expect(response.status).toBe(200);

    const [part1, part2] = await Array.fromAsync(streamParts(response));

    expect(await part1.json()).toEqual({ position: 1 });
    expect((await part2.bytes()).length).toBe(500);
  });

  it("should stream the queue position", async () => {
    const query = new URLSearchParams({
      width: "100",
      height: "1000",
    });
    const r1 = server.fetch(
      new Request(`http://localhost:3000/images/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
      })
    );
    const r2 = server.fetch(
      new Request(`http://localhost:3000/images/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
      })
    );

    const [part1] = await Array.fromAsync(streamParts(await r1));
    const [part2] = await Array.fromAsync(streamParts(await r2));

    expect(await part1.json()).toEqual({ position: 1 });
    expect(await part2.json()).toEqual({ position: 2 });
  });

  it("should throw if format is invalid", async () => {
    const query = new URLSearchParams({ format: "x" });
    const res = await server.fetch(
      new Request(`http://localhost:3000/images/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
      })
    );

    expect(res.status).toBe(400);
    expect(await res.text()).toEqual("[/format] Expected union value");
  });

  it("should return 400 if no options are provided", async () => {
    const res = await server.fetch(
      new Request(`http://localhost:3000/images/process`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
      })
    );

    expect(res.status).toBe(400);
    expect(await res.text()).toBe("No options provided");
  });

  it("should return 400 if X-Options header is not valid JSON", async () => {
    const res = await server.fetch(
      new Request(`http://localhost:3000/images/process`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
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
        body: Bun.file("fixtures/image.jpeg"),
        headers: {
          "X-Options": JSON.stringify([
            { format: "avif", quality: 40 },
            { format: "webp", quality: 40 },
          ] satisfies OptimizerOptions[]),
        },
      })
    );

    const [, file1, file2] = await Array.fromAsync(streamParts(response));

    expect(response.status).toBe(200);
    expect(file1.type).toBe("image/avif");
    expect(file2.type).toBe("image/webp");
    expect(file1.filename).toBe("file1.avif");
    expect(file2.filename).toBe("file2.webp");
    expect((await file1.bytes()).length).toBe(967);
    expect((await file2.bytes()).length).toBe(1410);
  });
});
