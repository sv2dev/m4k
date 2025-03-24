import {
  ProcessedFile,
  type ProcessingError,
  type Progress,
  type QueuePosition,
} from "@m4k/common";
import { describe, expect, it } from "bun:test";
import { processVideo, videoQueue } from "./video-processor";

const fixture = Bun.file(`../../fixtures/video.mp4`);

describe("processVideo()", () => {
  it("should process a video", async () => {
    const iterable = processVideo(fixture.name!, { format: "mp4" })!;

    const collected = await collect(iterable);

    expect(collected.length).toBe(4);
    expect(collected).toEqual([
      { position: 0 },
      { progress: 0 },
      { progress: 100 },
      {
        filename: expect.any(String),
        type: "video/mp4",
        size: expect.any(Number),
      },
    ]);
    expect((collected[3] as { size: number }).size).toBeGreaterThan(10000);
  });

  it("should process multiple videos in sequence", async () => {
    const iterable1 = processVideo(fixture.name!, { format: "mp4" })!;

    const collected = await collect(iterable1);

    expect(collected[0]).toEqual({ position: 0 });
    expect((collected.at(-1) as { size: number }).size).toBeGreaterThan(10000);

    const iterable2 = processVideo(fixture.name!, { format: "mp4" })!;

    const collected2 = await collect(iterable2);

    expect(collected2[0]).toEqual({ position: 0 });
    expect((collected2.at(-1) as { size: number }).size).toBeGreaterThan(10000);
  });

  it("should enqueue processing multiple videos ", async () => {
    const iterable1 = processVideo(fixture.name!, { format: "mp4" })!;
    const iterable2 = processVideo(fixture.name!, { format: "mp4" })!;

    const [collected1, collected2] = await Promise.all([
      collect(iterable1),
      collect(iterable2),
    ]);

    expect(collected1[0]).toEqual({ position: 0 });
    expect((collected1.at(-1) as { size: number }).size).toBeGreaterThan(10000);
    expect(collected2[0]).toEqual({ position: 1 });
    expect((collected2.at(-1) as { size: number }).size).toBeGreaterThan(10000);
    expect(videoQueue.running).toBe(0);
    expect(videoQueue.queued).toBe(0);
  });

  it("should handle abort signals", async () => {
    const iterable = processVideo(
      fixture.name!,
      { format: "mp4" },
      { signal: AbortSignal.timeout(0) }
    )!;

    try {
      await collect(iterable);
      throw new Error("Should not reach here");
    } catch (e) {
      expect((e as Error).name).toBe("TimeoutError");
    }
  });
});

async function collect(
  iterable: AsyncIterable<
    QueuePosition | Progress | ProcessingError | ProcessedFile
  >
) {
  const collected: (
    | QueuePosition
    | Progress
    | ProcessingError
    | { filename: string; type: string; size: number }
  )[] = [];
  for await (const part of iterable) {
    if (part instanceof ProcessedFile) {
      const f = Bun.file(part.name);
      collected.push({
        filename: f.name!,
        type: f.type,
        size: f.size,
      });
    } else {
      collected.push(part);
    }
  }
  return collected;
}
