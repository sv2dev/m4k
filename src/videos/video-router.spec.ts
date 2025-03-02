import { streamParts } from "@sv2dev/multipart-stream";
import { describe, expect, it } from "bun:test";
import { server } from "../server";
import type { ProcessingError, Progress, QueuePosition } from "../types";
import {
  getAudioEncoders,
  getAudioFilters,
  getInputFormats,
  getOutputFormats,
  getVideoEncoders,
  getVideoFilters,
} from "./video-utils";

describe("/process", () => {
  it("should process a video", async () => {
    const query = new URLSearchParams({
      format: "mp4",
    });
    const response = await server.fetch(
      new Request(`http://localhost:3000/videos/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
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
    const query = new URLSearchParams({
      format: "mp4",
    });
    const res1 = server.fetch(
      new Request(`http://localhost:3000/videos/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );
    const res2 = server.fetch(
      new Request(`http://localhost:3000/videos/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );

    const [response1, response2] = await Promise.all([res1, res2]);

    expect(response1.status).toBe(200);
    const video1 = (await collectResponse(response1)).find((x) => "type" in x)!;
    expect(video1.filename).toMatch(/\.mp4$/);
    expect(video1.size).toBeGreaterThan(1000);

    expect(response2.status).toBe(200);
    const video2 = (await collectResponse(response2)).find((x) => "type" in x)!;
    expect(video2.filename).toMatch(/\.mp4$/);
    expect(video2.size).toBeGreaterThan(1000);
  });

  it("should stream the queue position", async () => {
    const query = new URLSearchParams({
      format: "mp4",
    });
    const res1 = server.fetch(
      new Request(`http://localhost:3000/videos/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );
    const res2 = server.fetch(
      new Request(`http://localhost:3000/videos/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
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
    const query = new URLSearchParams({
      format: "mp4",
      output: "/tmp/test-output.mp4",
    });

    const response = await server.fetch(
      new Request(`http://localhost:3000/videos/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
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
    const response = await server.fetch(
      new Request(`http://localhost:3000/videos/process`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("No options provided");
  });

  it("should return 400 if options are invalid json", async () => {
    const response = await server.fetch(
      new Request(`http://localhost:3000/videos/process`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
        headers: { "X-Options": "{" },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("Error while parsing options");
  });

  it("should return 400 if options are invalid", async () => {
    const response = await server.fetch(
      new Request(`http://localhost:3000/videos/process`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
        headers: { "X-Options": JSON.stringify({ fps: "abc" }) },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("[/fps] Expected number");
  });
});

describe("/videos/formats", () => {
  it("should return supported formats", async () => {
    const response = await server.fetch(
      new Request("http://localhost:3000/videos/formats")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(await getOutputFormats());
  });
});

describe("/videos/input-formats", () => {
  it("should return supported formats", async () => {
    const response = await server.fetch(
      new Request("http://localhost:3000/videos/input-formats")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(await getInputFormats());
  });
});

describe("/videos/encoders", () => {
  it("should return supported encoders", async () => {
    const response = await server.fetch(
      new Request("http://localhost:3000/videos/encoders")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(await getVideoEncoders());
  });
});

describe("/videos/filters", () => {
  it("should return supported filters", async () => {
    const response = await server.fetch(
      new Request("http://localhost:3000/videos/filters")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(await getVideoFilters());
  });
});

describe("/videos/audio-encoders", () => {
  it("should return supported audio encoders", async () => {
    const response = await server.fetch(
      new Request("http://localhost:3000/videos/audio-encoders")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(await getAudioEncoders());
  });
});

describe("/videos/audio-filters", () => {
  it("should return supported audio filters", async () => {
    const response = await server.fetch(
      new Request("http://localhost:3000/videos/audio-filters")
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(await getAudioFilters());
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
      collected.push({
        filename: part.filename!,
        type: part.type!,
        size: (await part.bytes()).length,
      });
    }
  }
  return collected;
}
