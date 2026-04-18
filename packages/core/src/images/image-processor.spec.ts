import { ProcessedFile, type Progress, type QueuePosition } from "@m4k/common";
import { describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { ffmpeg, processImage } from "./image-processor";

// ffmpeg 5+ required for AVIF demux; @ffmpeg-installer ships 4.x
const ffmpegSupportsAvif = await new Promise<boolean>((resolve) => {
  const p = spawn(ffmpeg, [
    "-y", "-i", "../../fixtures/image-10bit.avif",
    "-update", "1", "-frames:v", "1", "/tmp/m4k-avif-probe.png",
  ], { stdio: "pipe" });
  p.on("close", (code) => resolve(code === 0));
});

const jpegFixture = Bun.file(`../../fixtures/image.jpeg`);
const avifFixture = Bun.file(`../../fixtures/image.avif`);
const avif10bitFixture = Bun.file(`../../fixtures/image-10bit.avif`);

describe("processImage()", () => {
  it("should process a JPEG to AVIF", async () => {
    const results = await collectFiles(processImage(jpegFixture.name!, { format: "avif" })!);

    expect(results).toHaveLength(1);
    expect(results[0].name).toMatch(/\.avif$/);
    expect(results[0].data.byteLength).toBeGreaterThan(0);
  });

  it("should process a standard 8-bit AVIF to WebP", async () => {
    const results = await collectFiles(processImage(avifFixture.name!, { format: "webp" })!);

    expect(results).toHaveLength(1);
    expect(results[0].name).toMatch(/\.webp$/);
    expect(results[0].data.byteLength).toBeGreaterThan(0);
  });

  it("should skip conversion when format matches input and no transforms (no-op)", async () => {
    const originalBytes = await readFile(avif10bitFixture.name!);
    const results = await collectFiles(processImage(avif10bitFixture.name!, { format: "avif" })!);

    expect(results).toHaveLength(1);
    expect(results[0].data).toEqual(originalBytes);
  });

  it("should skip conversion for buffer no-op (10-bit AVIF buffer → AVIF)", async () => {
    const originalBytes = await readFile(avif10bitFixture.name!);
    const results = await collectFiles(processImage(toAsyncIterable(originalBytes), { format: "avif" })!);

    expect(results).toHaveLength(1);
    expect(results[0].data).toEqual(originalBytes);
  });

  it.skipIf(!ffmpegSupportsAvif)("should convert 10-bit AVIF to WebP via ffmpeg fallback", async () => {
    const results = await collectFiles(processImage(avif10bitFixture.name!, { format: "webp" })!);

    expect(results).toHaveLength(1);
    expect(results[0].name).toMatch(/\.webp$/);
    expect(results[0].data.byteLength).toBeGreaterThan(0);
  });

  it.skipIf(!ffmpegSupportsAvif)("should resize 10-bit AVIF to AVIF via ffmpeg fallback", async () => {
    const results = await collectFiles(
      processImage(avif10bitFixture.name!, { format: "avif", resize: { width: 300 } })!
    );

    expect(results).toHaveLength(1);
    expect(results[0].name).toMatch(/\.avif$/);
    expect(results[0].data.byteLength).toBeGreaterThan(0);
  });

  it("should process multiple output formats", async () => {
    const results = await collectFiles(
      processImage(jpegFixture.name!, [{ format: "avif" }, { format: "webp" }])!
    );

    expect(results).toHaveLength(2);
    expect(results[0].name).toMatch(/\.avif$/);
    expect(results[1].name).toMatch(/\.webp$/);
  });
});

async function collectFiles(
  iterable: AsyncIterable<QueuePosition | Progress | ProcessedFile>
): Promise<{ name: string; data: Buffer }[]> {
  const results: { name: string; data: Buffer }[] = [];
  for await (const item of iterable) {
    if (item instanceof ProcessedFile && item.stream) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of item.stream) chunks.push(chunk);
      results.push({ name: item.name, data: Buffer.concat(chunks) });
    }
  }
  return results;
}

// eslint-disable-next-line typescript/require-await
async function* toAsyncIterable(buf: Buffer): AsyncIterable<Uint8Array> {
  yield new Uint8Array(buf);
}
