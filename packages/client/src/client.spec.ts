import { ProcessedFile } from "@m4k/common";
import serveOpts from "@m4k/server";
import { describe, expect, it } from "bun:test";
import { processAudio, processImage, processVideo, setFetch } from "./client";

setFetch(async (x) =>
  serveOpts.fetch.call(serveOpts as any, new Request(x), null as any)
);

describe("processAudio()", () => {
  it("should query the server to process an audio file", async () => {
    const audio = Bun.file("../../fixtures/audio.mp3");
    const files: { name: string; type: string; size: number }[] = [];

    for await (const x of processAudio("http://localhost:3000", audio, [
      { format: "mp3", name: "audio.mp3", codec: "copy" },
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
      { name: "audio.mp3", type: "audio/mpeg", size: 52288 },
    ]);
  });
});

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
      { name: "image.avif", type: "image/avif", size: expect.any(Number) }, // The size is not consistent across systems
    ]);
  });
});

describe("processVideo()", () => {
  it("should query the server to process a video", async () => {
    const video = Bun.file("../../fixtures/video.mp4");
    const files: { name: string; type: string; size: number }[] = [];

    for await (const x of processVideo("http://localhost:3000", video, [
      { ext: "mp4", name: "video.mp4", videoCodec: "copy" },
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
      { name: "video.mp4", type: "video/mp4", size: expect.any(Number) },
    ]);
  });

  it("should immediately throw an error if the signal is already aborted", async () => {
    const video = Bun.file("../../fixtures/video.mp4");
    try {
      await Array.fromAsync(
        processVideo(
          "http://localhost:3000",
          video,
          [{ format: "mp4", name: "video.mp4" }],
          { signal: AbortSignal.abort() }
        )
      );
      throw new Error("should not get here");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).name).toBe("AbortError");
    }
  });

  it("should abort the request via the signal", async () => {
    const video = Bun.file("../../fixtures/video.mp4");
    try {
      for await (const x of processVideo(
        "http://localhost:3000",
        video,
        [{ ext: "mp4", name: "video.mp4", videoCodec: "copy" }],
        { signal: AbortSignal.timeout(0) }
      )) {
      }
      throw new Error("should not get here");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).name).toBe("TimeoutError");
    }

    // Wait a bit to let any unhandled rejections be reported
    await Bun.sleep(100);
  });
});
