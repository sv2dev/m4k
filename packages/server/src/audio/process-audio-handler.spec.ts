import type {
  ProcessingError,
  Progress,
  QueuePosition,
  RemoteAudioOptions,
} from "@m4k/common";
import { streamParts } from "@sv2dev/multipart-stream";
import { describe, expect, it } from "bun:test";
import { processAudioHandler } from "./process-audio-handler";

const fixture = Bun.file(`../../fixtures/audio.mp3`);

describe("/process", () => {
  it("should process an audio file", async () => {
    const opts: RemoteAudioOptions = {
      format: "ogg",
      codec: "libvorbis",
    };
    const response = await processAudioHandler(
      new Request(`http://localhost:3000/audio/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": JSON.stringify(opts) },
      })
    );

    expect(response.status).toBe(200);
    const collected = await collectResponse(response);

    const audioInfo = collected.find((x) => "type" in x)!;
    expect(audioInfo.filename).toEqual(expect.stringContaining(".ogg"));
    expect(audioInfo.type).toEqual("audio/ogg");
    expect(audioInfo.size).toBeGreaterThan(1000);
  });

  it("should process multiple audio files in sequence", async () => {
    const opts: RemoteAudioOptions = {
      format: "ogg",
      codec: "libvorbis",
    };
    const res1 = await processAudioHandler(
      new Request(`http://localhost:3000/audio/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": JSON.stringify(opts) },
      })
    );
    const coll1 = await collectResponse(res1);

    const res2 = await processAudioHandler(
      new Request(`http://localhost:3000/audio/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": JSON.stringify(opts) },
      })
    );
    const coll2 = await collectResponse(res2);

    expect(res1.status).toBe(200);
    const audio1 = coll1.find((x) => "type" in x)!;
    expect(audio1.filename).toMatch(/\.ogg$/);
    expect(audio1.size).toBeGreaterThan(1000);

    expect(res2.status).toBe(200);
    const audio2 = coll2.find((x) => "type" in x)!;
    expect(audio2.filename).toMatch(/\.ogg$/);
    expect(audio2.size).toBeGreaterThan(1000);
  });

  it("should stream the queue position", async () => {
    const opts: RemoteAudioOptions = {
      format: "ogg",
      codec: "libvorbis",
    };
    const res1 = processAudioHandler(
      new Request(`http://localhost:3000/audio/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": JSON.stringify(opts) },
      })
    );
    await Bun.sleep(0); // Make sure the first request is queued
    const res2 = processAudioHandler(
      new Request(`http://localhost:3000/audio/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": JSON.stringify(opts) },
      })
    );

    const [coll1, coll2] = await Promise.all([
      (res1 as Promise<Response>).then(collectResponse),
      (res2 as Promise<Response>).then(collectResponse),
    ]);

    expect(coll1[0]).toEqual({ position: 0 });
    expect(coll2[0]).toEqual({ position: 1 });
    expect(coll2[1]).toEqual({ position: 0 });
  });

  it("should not stream back, if output is provided", async () => {
    const opts: RemoteAudioOptions = {
      format: "ogg",
      codec: "libvorbis",
      output: "/tmp/test-output.ogg",
    };

    const response = await processAudioHandler(
      new Request(`http://localhost:3000/audio/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": JSON.stringify(opts) },
      })
    );

    expect(response.status).toBe(200);
    let notifications: (QueuePosition | Progress)[] = [];
    for await (const part of streamParts(response)) {
      if (part.type === "application/json") {
        notifications.push((await part.json()) as QueuePosition | Progress);
      }
    }
    expect(notifications[0]).toEqual({ position: 0 });
    expect(notifications[1]).toEqual({ progress: 0 });
    const file = Bun.file("/tmp/test-output.ogg");
    expect(file.size).toBeGreaterThan(1000);
    await file.unlink();
  });

  it("should return 400 if no options are provided", async () => {
    const response = await processAudioHandler(
      new Request(`http://localhost:3000/audio/process`, {
        method: "POST",
        body: fixture,
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("No options provided");
  });

  it("should return 400 if options are invalid json", async () => {
    const response = await processAudioHandler(
      new Request(`http://localhost:3000/audio/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": "{" },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("Error while parsing options");
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
      const json = await part.json();
      collected.push(json as QueuePosition | Progress | ProcessingError);
    } else if (part.type !== "text/plain") {
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
