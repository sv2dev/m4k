import {
  ConvertedFile,
  type ProcessingError,
  type Progress,
  type QueuePosition,
} from "@m4k/common";
import { afterAll, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { optimizeVideo, videoQueue } from "./video-optimizer";

const fixture = Bun.file(`../../fixtures/video.mp4`);

afterAll(async () => rm("/tmp/videos", { force: true, recursive: true }));

describe("optimizeVideo()", () => {
  it("should process a video", async () => {
    const iterable = optimizeVideo(fixture.name!, { format: "mp4" })!;

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
    const iterable1 = optimizeVideo(fixture.name!, { format: "mp4" })!;

    const collected = await collect(iterable1);

    expect(collected[0]).toEqual({ position: 0 });
    expect((collected.at(-1) as { size: number }).size).toBeGreaterThan(10000);

    const iterable2 = optimizeVideo(fixture.name!, { format: "mp4" })!;

    const collected2 = await collect(iterable2);

    expect(collected2[0]).toEqual({ position: 0 });
    expect((collected2.at(-1) as { size: number }).size).toBeGreaterThan(10000);
  });

  it("should enqueue processing multiple videos ", async () => {
    const iterable1 = optimizeVideo(fixture.name!, { format: "mp4" })!;
    const iterable2 = optimizeVideo(fixture.name!, { format: "mp4" })!;

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
});

async function collect(
  iterable: AsyncIterable<
    QueuePosition | Progress | ProcessingError | ConvertedFile
  >
) {
  const collected: (
    | QueuePosition
    | Progress
    | ProcessingError
    | { filename: string; type: string; size: number }
  )[] = [];
  for await (const part of iterable) {
    if (part instanceof ConvertedFile) {
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
