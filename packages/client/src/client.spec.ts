import { ProcessedFile } from "@m4k/common";
import serveOpts from "@m4k/server";
import { describe, expect, it } from "bun:test";
import { processImage, setFetch } from "./client";
setFetch(async (x) =>
  serveOpts.fetch.call(serveOpts as any, new Request(x), null as any)
);

describe("processImage()", () => {
  it("should query the server to process an image", async () => {
    const img = Bun.file("../../fixtures/image.jpeg");
    const files: { name: string; type: string; size: number }[] = [];

    for await (const x of processImage("http://localhost:3000", img, [
      { format: "webp", name: "image.webp" },
      { format: "avif", name: "image.avif" },
    ])) {
      if (x instanceof ProcessedFile) {
        const chunks = await Array.fromAsync(x.stream);
        files.push({
          name: x.name,
          type: x.type,
          size: chunks.reduce((sum, chunk) => sum + chunk.length, 0),
        });
      }
    }

    expect(files).toEqual([
      { name: "image.webp", type: "image/webp", size: 2124 },
      { name: "image.avif", type: "image/avif", size: 1179 },
    ]);
  });
});
