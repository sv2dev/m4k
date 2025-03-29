import {
  ProcessedFile,
  type ProcessingError,
  type Progress,
  type QueuePosition,
} from "@m4k/common";
import { describe, expect, it } from "bun:test";
import { audioQueue, processAudio } from "./audio-processor";

const fixture = Bun.file(`../../fixtures/audio.mp3`);

describe("processAudio()", () => {
  it("should process an audio file", async () => {
    const iterable = processAudio(fixture.name!, {
      format: "ogg",
      codec: "libvorbis",
    })!;

    const collected = await collect(iterable);

    expect(collected).toEqual([
      { position: 0 },
      { progress: 0 },
      { progress: expect.any(Number) },
      { progress: 100 },
      {
        filename: expect.any(String),
        type: "audio/ogg",
        size: expect.any(Number),
      },
    ]);
    expect((collected[4] as { size: number }).size).toBeGreaterThan(10000);
  });

  it("should process a file with multiple codecs", async () => {
    const iterable = processAudio(fixture.name!, [
      { format: "ogg", codec: "libvorbis" },
      { format: "wav", codec: "pcm_u8" },
    ])!;

    const collected = await collect(iterable);

    expect(collected).toEqual([
      { position: 0 },
      { progress: 0 },
      { progress: expect.any(Number) },
      { progress: 100 },
      {
        filename: expect.any(String),
        type: "audio/ogg",
        size: expect.any(Number),
      },
      {
        filename: expect.any(String),
        type: "audio/x-wav",
        size: expect.any(Number),
      },
    ]);
  });

  it("should process multiple audio files in sequence", async () => {
    const iterable1 = processAudio(fixture.name!, {
      format: "ogg",
      codec: "libvorbis",
    })!;

    const collected = await collect(iterable1);

    expect(collected[0]).toEqual({ position: 0 });
    expect((collected.at(-1) as { size: number }).size).toBeGreaterThan(10000);

    const iterable2 = processAudio(fixture.name!, {
      format: "wav",
      codec: "pcm_u8",
    })!;

    const collected2 = await collect(iterable2);

    expect(collected2[0]).toEqual({ position: 0 });
    expect((collected2.at(-1) as { size: number }).size).toBeGreaterThan(10000);
  });

  it("should enqueue processing multiple audio files ", async () => {
    const iterable1 = processAudio(fixture.name!, {
      format: "ogg",
      codec: "libvorbis",
    })!;
    const iterable2 = processAudio(fixture.name!, {
      format: "wav",
      codec: "pcm_u8",
    })!;

    const [collected1, collected2] = await Promise.all([
      collect(iterable1),
      collect(iterable2),
    ]);

    expect(collected1[0]).toEqual({ position: 0 });
    expect((collected1.at(-1) as { size: number }).size).toBeGreaterThan(10000);
    expect(collected2[0]).toEqual({ position: 1 });
    expect((collected2.at(-1) as { size: number }).size).toBeGreaterThan(10000);
    expect(audioQueue.running).toBe(0);
    expect(audioQueue.queued).toBe(0);
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
