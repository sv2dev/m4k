import { streamParts } from "@sv2dev/multipart-stream";
import { describe, expect, it } from "bun:test";
import type {
  ProcessingError,
  Progress,
  QueuePosition,
  VideoOptions,
} from "m4k";
import { processVideoHandler } from "./process-video-handler";

const fixture = Bun.file(`../../fixtures/video.mp4`);

describe("/process", () => {
  it("should process a video", async () => {
    const query = new URLSearchParams({
      format: "mp4",
      videoCodec: "copy",
      audioCodec: "copy",
    });
    const response = await processVideoHandler(
      new Request(`http://localhost:3000/videos/process?${query}`, {
        method: "POST",
        body: fixture,
      })
    );

    expect(response.status).toBe(200);
    const collected = await collectResponse(response);

    const videoInfo = collected.find((x) => "type" in x)!;
    expect(videoInfo.filename).toEqual(expect.stringContaining(".mp4"));
    expect(videoInfo.type).toEqual("video/mp4");
    expect(videoInfo.size).toBeGreaterThan(1000);
  });

  it("should process multiple videos in sequence", async () => {
    const opts: VideoOptions = {
      format: "mp4",
      videoCodec: "copy",
      audioCodec: "copy",
    };
    const res1 = await processVideoHandler(
      new Request(`http://localhost:3000/videos/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": JSON.stringify(opts) },
      })
    );
    const coll1 = await collectResponse(res1);

    const res2 = await processVideoHandler(
      new Request(`http://localhost:3000/videos/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": JSON.stringify(opts) },
      })
    );
    const coll2 = await collectResponse(res2);

    expect(res1.status).toBe(200);
    const video1 = coll1.find((x) => "type" in x)!;
    expect(video1.filename).toMatch(/\.mp4$/);
    expect(video1.size).toBeGreaterThan(1000);

    expect(res2.status).toBe(200);
    const video2 = coll2.find((x) => "type" in x)!;
    expect(video2.filename).toMatch(/\.mp4$/);
    expect(video2.size).toBeGreaterThan(1000);
  });

  it("should stream the queue position", async () => {
    const opts: VideoOptions = {
      format: "mp4",
      videoCodec: "copy",
      audioCodec: "copy",
    };
    const res1 = processVideoHandler(
      new Request(`http://localhost:3000/videos/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": JSON.stringify(opts) },
      })
    );
    await Bun.sleep(0); // Make sure the first request is queued
    const res2 = processVideoHandler(
      new Request(`http://localhost:3000/videos/process`, {
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
    const opts: VideoOptions = {
      format: "mp4",
      videoCodec: "copy",
      audioCodec: "copy",
      output: "/tmp/test-output.mp4",
    };

    const response = await processVideoHandler(
      new Request(`http://localhost:3000/videos/process`, {
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
    const file = Bun.file("/tmp/test-output.mp4");
    expect(file.size).toBeGreaterThan(1000);
    await file.unlink();
  });

  it("should return 400 if no options are provided", async () => {
    const response = await processVideoHandler(
      new Request(`http://localhost:3000/videos/process`, {
        method: "POST",
        body: fixture,
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("No options provided");
  });

  it("should return 400 if options are invalid json", async () => {
    const response = await processVideoHandler(
      new Request(`http://localhost:3000/videos/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": "{" },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("Error while parsing options");
  });

  it("should return 400 if options are invalid", async () => {
    const response = await processVideoHandler(
      new Request(`http://localhost:3000/videos/process`, {
        method: "POST",
        body: fixture,
        headers: { "X-Options": JSON.stringify({ fps: "abc" }) },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("[/fps] Expected number");
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
